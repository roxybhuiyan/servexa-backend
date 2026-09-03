import { Prisma } from '../../../generated/prisma/client.js';
import { BookingStatus, PaymentStatus, ProviderStatus, ServiceStatus, UserStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import config from '../../../config/index.js';
import AppError from '../../errors/AppError.js';

type AuditContext = { ipAddress?: string; userAgent?: string };
type BookingPayload = { serviceId: string; slotId: string; notes?: string };
type BookingListQuery = { page: number; limit: number; status?: BookingStatus; serviceId?: string; sortOrder: 'asc' | 'desc' };

const pageData = <T>(data: T[], total: number, page: number, limit: number) => ({
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data,
});

const paymentSelect = { select: { status: true, amount: true, paidAt: true } } as const;
const customerBookingSelect = {
  id: true, status: true, servicePrice: true, platformFee: true, totalAmount: true, notes: true,
  createdAt: true, updatedAt: true, cancelledAt: true, completedAt: true,
  service: { select: { id: true, title: true, slug: true, duration: true, imageUrl: true } },
  provider: { select: { id: true, businessName: true, city: true, phone: true } },
  slot: { select: { id: true, startTime: true, endTime: true, isBooked: true } }, payment: paymentSelect,
} as const;
const providerBookingSelect = {
  ...customerBookingSelect,
  customer: { select: { id: true, name: true, phone: true } },
} as const;

const platformFeePercent = new Prisma.Decimal(config.platformFeePercent);
const calculatePrice = (servicePrice: Prisma.Decimal) => {
  const fee = servicePrice.mul(platformFeePercent).div(100).toDecimalPlaces(2);
  return { servicePrice, platformFee: fee, totalAmount: servicePrice.add(fee) };
};

const requireCustomer = async (userId: string) => {
  const customer = await prisma.user.findFirst({
    where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null }, select: { id: true },
  });
  if (!customer) throw new AppError(403, 'An active customer account is required');
  return customer;
};

const requireApprovedProvider = async (userId: string) => {
  const provider = await prisma.providerProfile.findFirst({
    where: { userId, status: ProviderStatus.APPROVED, deletedAt: null, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    select: { id: true },
  });
  if (!provider) throw new AppError(403, 'An approved active provider profile is required');
  return provider;
};

const canFreeSlot = (payment: { status: PaymentStatus } | null) => !payment || payment.status !== PaymentStatus.PAID;
const transition = (from: BookingStatus, to: BookingStatus) => {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    PENDING: [BookingStatus.ACCEPTED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
    ACCEPTED: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    CONFIRMED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.COMPLETED],
    COMPLETED: [], CANCELLED: [], REJECTED: [],
  };
  if (!allowed[from].includes(to)) throw new AppError(409, `Booking cannot transition from ${from} to ${to}`);
};

const findCustomerBooking = async (customerId: string, id: string) => {
  const booking = await prisma.booking.findFirst({ where: { id, customerId }, select: customerBookingSelect });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
};
const findProviderBooking = async (providerId: string, id: string) => {
  const booking = await prisma.booking.findFirst({ where: { id, providerId }, select: providerBookingSelect });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
};

export const createBooking = async (customerId: string, payload: BookingPayload, context: AuditContext) => {
  await requireCustomer(customerId);
  try {
    return await prisma.$transaction(async (transaction) => {
      const slot = await transaction.availabilitySlot.findFirst({
        where: { id: payload.slotId },
        select: {
          id: true, providerId: true, serviceId: true, startTime: true, isBooked: true,
          service: { select: {
            id: true, price: true, status: true, deletedAt: true, category: { select: { deletedAt: true } },
            provider: { select: { id: true, userId: true, status: true, deletedAt: true, user: { select: { status: true, deletedAt: true } } }, },
          } },
        },
      });
      if (!slot || slot.serviceId !== payload.serviceId || slot.providerId !== slot.service.provider.id) throw new AppError(404, 'Available slot not found');
      const provider = slot.service.provider;
      if (slot.isBooked || slot.startTime <= new Date()) throw new AppError(409, 'Slot is no longer available');
      if (slot.service.status !== ServiceStatus.ACTIVE || slot.service.deletedAt || slot.service.category.deletedAt) throw new AppError(404, 'Service not found');
      if (provider.status !== ProviderStatus.APPROVED || provider.deletedAt || provider.user.status !== UserStatus.ACTIVE || provider.user.deletedAt) throw new AppError(404, 'Service not found');
      if (provider.userId === customerId) throw new AppError(403, 'You cannot book your own service');

      const reserved = await transaction.availabilitySlot.updateMany({
        where: { id: slot.id, isBooked: false, startTime: { gt: new Date() } }, data: { isBooked: true },
      });
      if (reserved.count !== 1) throw new AppError(409, 'Slot is no longer available');
      const money = calculatePrice(slot.service.price);
      const booking = await transaction.booking.create({
        data: { customerId, providerId: slot.providerId, serviceId: slot.serviceId, slotId: slot.id, notes: payload.notes, ...money },
        select: customerBookingSelect,
      });
      await createAuditLog(transaction, {
        userId: customerId, action: 'BOOKING_CREATED', entityType: 'Booking', entityId: booking.id,
        newData: { status: booking.status, serviceId: booking.service.id, slotId: booking.slot.id, totalAmount: booking.totalAmount.toString() }, ...context,
      });
      return booking;
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new AppError(409, 'Slot is already booked');
    throw error;
  }
};

export const listCustomerBookings = async (customerId: string, query: BookingListQuery) => {
  const where: Prisma.BookingWhereInput = { customerId, ...(query.status ? { status: query.status } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) };
  const [total, data] = await prisma.$transaction([
    prisma.booking.count({ where }), prisma.booking.findMany({ where, select: customerBookingSelect, orderBy: { createdAt: query.sortOrder }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return pageData(data, total, query.page, query.limit);
};
export const getCustomerBooking = (customerId: string, id: string) => findCustomerBooking(customerId, id);

export const cancelBooking = async (customerId: string, id: string, context: AuditContext) => {
  const booking = await findCustomerBooking(customerId, id);
  transition(booking.status, BookingStatus.CANCELLED);
  if (!canFreeSlot(booking.payment)) throw new AppError(409, 'A paid booking cannot be cancelled until refund handling is available');
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() }, select: customerBookingSelect });
    await transaction.availabilitySlot.update({ where: { id: booking.slot.id }, data: { isBooked: false } });
    await createAuditLog(transaction, { userId: customerId, action: 'BOOKING_CANCELLED', entityType: 'Booking', entityId: id, oldData: { status: booking.status }, newData: { status: updated.status }, ...context });
    return updated;
  });
};

export const listProviderBookings = async (userId: string, query: BookingListQuery) => {
  const provider = await requireApprovedProvider(userId);
  const where: Prisma.BookingWhereInput = { providerId: provider.id, ...(query.status ? { status: query.status } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) };
  const [total, data] = await prisma.$transaction([
    prisma.booking.count({ where }), prisma.booking.findMany({ where, select: providerBookingSelect, orderBy: { createdAt: query.sortOrder }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return pageData(data, total, query.page, query.limit);
};
export const getProviderBooking = async (userId: string, id: string) => findProviderBooking((await requireApprovedProvider(userId)).id, id);

const updateProviderBooking = async (userId: string, id: string, status: BookingStatus, action: string, context: AuditContext) => {
  const provider = await requireApprovedProvider(userId);
  const booking = await findProviderBooking(provider.id, id);
  transition(booking.status, status);
  if (status === BookingStatus.REJECTED && !canFreeSlot(booking.payment)) throw new AppError(409, 'A paid booking cannot be rejected until refund handling is available');
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.booking.update({ where: { id }, data: { status, ...(status === BookingStatus.COMPLETED ? { completedAt: new Date() } : {}) }, select: providerBookingSelect });
    if (status === BookingStatus.REJECTED) await transaction.availabilitySlot.update({ where: { id: booking.slot.id }, data: { isBooked: false } });
    await createAuditLog(transaction, { userId, action, entityType: 'Booking', entityId: id, oldData: { status: booking.status }, newData: { status: updated.status }, ...context });
    return updated;
  });
};

export const acceptBooking = (userId: string, id: string, context: AuditContext) => updateProviderBooking(userId, id, BookingStatus.ACCEPTED, 'BOOKING_ACCEPTED', context);
export const rejectBooking = (userId: string, id: string, context: AuditContext) => updateProviderBooking(userId, id, BookingStatus.REJECTED, 'BOOKING_REJECTED', context);
export const startBooking = (userId: string, id: string, context: AuditContext) => updateProviderBooking(userId, id, BookingStatus.IN_PROGRESS, 'BOOKING_STARTED', context);
export const completeBooking = (userId: string, id: string, context: AuditContext) => updateProviderBooking(userId, id, BookingStatus.COMPLETED, 'BOOKING_COMPLETED', context);
