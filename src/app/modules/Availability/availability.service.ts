import { Prisma } from '../../../generated/prisma/client.js';
import { ProviderStatus, ServiceStatus, UserStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type AuditContext = { ipAddress?: string; userAgent?: string };
type SlotPayload = { serviceId: string; startTime: string; endTime: string };
type UpdateSlotPayload = Partial<SlotPayload>;

const slotSelect = {
  id: true,
  providerId: true,
  serviceId: true,
  startTime: true,
  endTime: true,
  isBooked: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, title: true, slug: true, duration: true, status: true } },
} as const;

const pageData = <T>(data: T[], total: number, page: number, limit: number) => ({
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  data,
});

const toDate = (value: string, label: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, `${label} must be a valid ISO datetime`);
  return date;
};

const validateTimes = (startTime: string, endTime: string) => {
  const start = toDate(startTime, 'startTime');
  const end = toDate(endTime, 'endTime');
  if (end <= start) throw new AppError(400, 'endTime must be later than startTime');
  if (start <= new Date()) throw new AppError(400, 'startTime must be in the future');
  return { start, end };
};

const findApprovedProvider = async (userId: string) => {
  const provider = await prisma.providerProfile.findFirst({
    where: {
      userId,
      status: ProviderStatus.APPROVED,
      deletedAt: null,
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    },
    select: { id: true },
  });
  if (!provider) throw new AppError(403, 'An approved active provider profile is required');
  return provider;
};

const findProvider = async (userId: string) => {
  const provider = await prisma.providerProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!provider) throw new AppError(404, 'Provider profile not found');
  return provider;
};

const ensureOwnedActiveService = async (providerId: string, serviceId: string) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId, status: ServiceStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  if (!service) throw new AppError(404, 'Active service not found');
};

const rejectOverlap = async (
  client: Pick<typeof prisma, 'availabilitySlot'>,
  providerId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string,
) => {
  const overlap = await client.availabilitySlot.findFirst({
    where: {
      providerId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });
  if (overlap) throw new AppError(409, 'Availability slot overlaps an existing provider slot');
};

export const listMyAvailability = async (
  userId: string,
  query: { serviceId?: string; from?: string; to?: string; isBooked?: boolean; page: number; limit: number; sortOrder: 'asc' | 'desc' },
) => {
  const provider = await findProvider(userId);
  const from = query.from ? toDate(query.from, 'from') : undefined;
  const to = query.to ? toDate(query.to, 'to') : undefined;
  if (from && to && to < from) throw new AppError(400, 'to must be later than from');
  const where: Prisma.AvailabilitySlotWhereInput = {
    providerId: provider.id,
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.isBooked !== undefined ? { isBooked: query.isBooked } : {}),
    ...(from || to ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [total, data] = await prisma.$transaction([
    prisma.availabilitySlot.count({ where }),
    prisma.availabilitySlot.findMany({
      where, select: slotSelect, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: { startTime: query.sortOrder },
    }),
  ]);
  return pageData(data, total, query.page, query.limit);
};

export const createAvailability = async (userId: string, payload: SlotPayload, context: AuditContext) => {
  const provider = await findApprovedProvider(userId);
  await ensureOwnedActiveService(provider.id, payload.serviceId);
  const { start, end } = validateTimes(payload.startTime, payload.endTime);
  return prisma.$transaction(async (transaction) => {
    await rejectOverlap(transaction, provider.id, start, end);
    const slot = await transaction.availabilitySlot.create({
      data: { providerId: provider.id, serviceId: payload.serviceId, startTime: start, endTime: end },
      select: slotSelect,
    });
    await createAuditLog(transaction, {
      userId, action: 'AVAILABILITY_CREATED', entityType: 'AvailabilitySlot', entityId: slot.id,
      newData: { serviceId: slot.serviceId, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() },
      ...context,
    });
    return slot;
  });
};

export const updateAvailability = async (userId: string, id: string, payload: UpdateSlotPayload, context: AuditContext) => {
  const provider = await findApprovedProvider(userId);
  const slot = await prisma.availabilitySlot.findFirst({ where: { id, providerId: provider.id }, select: slotSelect });
  if (!slot) throw new AppError(404, 'Availability slot not found');
  if (slot.isBooked) throw new AppError(409, 'A booked availability slot cannot be changed');
  const serviceId = payload.serviceId ?? slot.serviceId;
  const startValue = payload.startTime ?? slot.startTime.toISOString();
  const endValue = payload.endTime ?? slot.endTime.toISOString();
  await ensureOwnedActiveService(provider.id, serviceId);
  const { start, end } = validateTimes(startValue, endValue);
  return prisma.$transaction(async (transaction) => {
    await rejectOverlap(transaction, provider.id, start, end, slot.id);
    const updated = await transaction.availabilitySlot.update({
      where: { id: slot.id }, data: { serviceId, startTime: start, endTime: end }, select: slotSelect,
    });
    await createAuditLog(transaction, {
      userId, action: 'AVAILABILITY_UPDATED', entityType: 'AvailabilitySlot', entityId: slot.id,
      oldData: { serviceId: slot.serviceId, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() },
      newData: { serviceId: updated.serviceId, startTime: updated.startTime.toISOString(), endTime: updated.endTime.toISOString() },
      ...context,
    });
    return updated;
  });
};

export const deleteAvailability = async (userId: string, id: string, context: AuditContext) => {
  const provider = await findApprovedProvider(userId);
  const slot = await prisma.availabilitySlot.findFirst({ where: { id, providerId: provider.id }, select: slotSelect });
  if (!slot) throw new AppError(404, 'Availability slot not found');
  if (slot.isBooked) throw new AppError(409, 'A booked availability slot cannot be deleted');
  await prisma.$transaction(async (transaction) => {
    await transaction.availabilitySlot.delete({ where: { id: slot.id } });
    await createAuditLog(transaction, {
      userId, action: 'AVAILABILITY_DELETED', entityType: 'AvailabilitySlot', entityId: slot.id,
      oldData: { serviceId: slot.serviceId, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() },
      newData: { deleted: true }, ...context,
    });
  });
};

export const listPublicAvailability = async (
  serviceId: string,
  query: { from?: string; to?: string; page: number; limit: number },
) => {
  const fromInput = query.from ? toDate(query.from, 'from') : new Date();
  const to = query.to ? toDate(query.to, 'to') : undefined;
  if (to && to < fromInput) throw new AppError(400, 'to must be later than from');
  const where: Prisma.AvailabilitySlotWhereInput = {
    serviceId, isBooked: false,
    startTime: { gte: fromInput, ...(to ? { lte: to } : {}) },
    service: {
      status: ServiceStatus.ACTIVE, deletedAt: null, category: { deletedAt: null },
      provider: { status: ProviderStatus.APPROVED, deletedAt: null, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    },
  };
  const [total, data] = await prisma.$transaction([
    prisma.availabilitySlot.count({ where }),
    prisma.availabilitySlot.findMany({
      where, select: { id: true, serviceId: true, startTime: true, endTime: true, createdAt: true },
      orderBy: { startTime: 'asc' }, skip: (query.page - 1) * query.limit, take: query.limit,
    }),
  ]);
  return pageData(data, total, query.page, query.limit);
};
