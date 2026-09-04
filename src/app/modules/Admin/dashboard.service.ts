import { BookingStatus, PaymentStatus, ProviderStatus, ServiceStatus, UserRole, UserStatus } from '../../../generated/prisma/enums.js';
import { Prisma } from '../../../generated/prisma/client.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type DateRange = { from?: Date; to?: Date };
type RevenueQuery = DateRange & { providerId?: string; serviceId?: string };
type BookingQuery = RevenueQuery & { customerId?: string };
type AuditLogQuery = DateRange & { page: number; limit: number; action?: string; entityType?: string; entityId?: string; userId?: string; sortOrder: 'asc' | 'desc' };

const money = (value: Prisma.Decimal | null | undefined) => (value ?? new Prisma.Decimal(0)).toFixed(2);
const rate = (part: number, total: number) => (total === 0 ? 0 : Number(((part / total) * 100).toFixed(2)));
const pageData = <T>(data: T[], total: number, page: number, limit: number) => ({ meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data });

const createdAtFilter = ({ from, to }: DateRange) =>
  from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

const bookingWhere = (query: BookingQuery) => ({
  ...createdAtFilter(query),
  ...(query.providerId ? { providerId: query.providerId } : {}),
  ...(query.serviceId ? { serviceId: query.serviceId } : {}),
  ...(query.customerId ? { customerId: query.customerId } : {}),
});

const actorSelect = { id: true, name: true, role: true } as const;
const activitySelect = { id: true, action: true, entityType: true, entityId: true, createdAt: true, user: { select: actorSelect } } as const;

const isSensitiveKey = (key: string) => {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return /password|secret|token|authorization|cookie|databaseurl|webhook|stripe.*key|card|cvv|jwt/.test(normalized);
};

export const sanitizeAuditData = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeAuditData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, isSensitiveKey(key) ? '[REDACTED]' : sanitizeAuditData(nestedValue)]),
    );
  }
  return value;
};

export const getDashboardOverview = async () => {
  const activeEntities = { deletedAt: null };
  const [users, providers, services, bookings, payments, reviews] = await Promise.all([
    Promise.all([
      prisma.user.count({ where: activeEntities }),
      prisma.user.count({ where: { ...activeEntities, status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { ...activeEntities, status: UserStatus.SUSPENDED } }),
      prisma.user.count({ where: { ...activeEntities, status: UserStatus.BLOCKED } }),
      prisma.user.count({ where: { ...activeEntities, role: UserRole.CUSTOMER } }),
      prisma.user.count({ where: { ...activeEntities, role: UserRole.PROVIDER } }),
    ]),
    Promise.all([
      prisma.providerProfile.count({ where: { ...activeEntities, user: { deletedAt: null } } }),
      prisma.providerProfile.count({ where: { ...activeEntities, user: { deletedAt: null }, status: ProviderStatus.PENDING } }),
      prisma.providerProfile.count({ where: { ...activeEntities, user: { deletedAt: null }, status: ProviderStatus.APPROVED } }),
      prisma.providerProfile.count({ where: { ...activeEntities, user: { deletedAt: null }, status: ProviderStatus.REJECTED } }),
    ]),
    Promise.all([
      prisma.service.count({ where: activeEntities }),
      prisma.service.count({ where: { ...activeEntities, status: ServiceStatus.ACTIVE } }),
      prisma.service.count({ where: { ...activeEntities, status: ServiceStatus.INACTIVE } }),
    ]),
    prisma.booking.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.payment.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.review.aggregate({ where: activeEntities, _count: { id: true }, _avg: { rating: true } }),
  ]);
  const bookingCounts = Object.fromEntries(bookings.map((item) => [item.status, item._count.id])) as Partial<Record<BookingStatus, number>>;
  const paymentCounts = Object.fromEntries(payments.map((item) => [item.status, item._count.id])) as Partial<Record<PaymentStatus, number>>;
  const countBooking = (status: BookingStatus) => bookingCounts[status] ?? 0;
  const countPayment = (status: PaymentStatus) => paymentCounts[status] ?? 0;

  return {
    users: { totalUsers: users[0], activeUsers: users[1], suspendedUsers: users[2], blockedUsers: users[3], totalCustomers: users[4], totalProviders: users[5] },
    providers: { totalProviders: providers[0], pendingProviders: providers[1], approvedProviders: providers[2], rejectedProviders: providers[3] },
    services: { totalServices: services[0], activeServices: services[1], inactiveServices: services[2] },
    bookings: { totalBookings: bookings.reduce((total, item) => total + item._count.id, 0), pendingBookings: countBooking(BookingStatus.PENDING), acceptedBookings: countBooking(BookingStatus.ACCEPTED), confirmedBookings: countBooking(BookingStatus.CONFIRMED), inProgressBookings: countBooking(BookingStatus.IN_PROGRESS), completedBookings: countBooking(BookingStatus.COMPLETED), cancelledBookings: countBooking(BookingStatus.CANCELLED), rejectedBookings: countBooking(BookingStatus.REJECTED) },
    payments: { totalPayments: payments.reduce((total, item) => total + item._count.id, 0), unpaidPayments: countPayment(PaymentStatus.UNPAID), paidPayments: countPayment(PaymentStatus.PAID), pendingPayments: countPayment(PaymentStatus.PENDING), failedPayments: countPayment(PaymentStatus.FAILED), cancelledPayments: countPayment(PaymentStatus.CANCELLED), refundedPayments: countPayment(PaymentStatus.REFUNDED) },
    reviews: { totalReviews: reviews._count.id, averageRating: reviews._avg.rating ? Number(reviews._avg.rating.toFixed(2)) : 0 },
  };
};

export const getRevenueDashboard = async (query: RevenueQuery) => {
  const aggregate = await prisma.booking.aggregate({
    where: { ...bookingWhere(query), payment: { is: { status: PaymentStatus.PAID } } },
    _count: { id: true },
    _sum: { totalAmount: true, platformFee: true },
  });
  const gross = aggregate._sum.totalAmount ?? new Prisma.Decimal(0);
  const platform = aggregate._sum.platformFee ?? new Prisma.Decimal(0);
  const count = aggregate._count.id;
  return { grossRevenue: money(gross), platformRevenue: money(platform), providerRevenue: money(gross.minus(platform)), paidBookingCount: count, averageOrderValue: money(count ? gross.dividedBy(count) : new Prisma.Decimal(0)) };
};

export const getBookingDashboard = async (query: BookingQuery) => {
  const grouped = await prisma.booking.groupBy({ by: ['status'], where: bookingWhere(query), _count: { id: true } });
  const counts = Object.fromEntries(grouped.map((item) => [item.status, item._count.id])) as Partial<Record<BookingStatus, number>>;
  const total = grouped.reduce((sum, item) => sum + item._count.id, 0);
  const value = (status: BookingStatus) => counts[status] ?? 0;
  return { totalBookings: total, counts: { pending: value(BookingStatus.PENDING), accepted: value(BookingStatus.ACCEPTED), confirmed: value(BookingStatus.CONFIRMED), inProgress: value(BookingStatus.IN_PROGRESS), completed: value(BookingStatus.COMPLETED), cancelled: value(BookingStatus.CANCELLED), rejected: value(BookingStatus.REJECTED) }, completionRate: rate(value(BookingStatus.COMPLETED), total), cancellationRate: rate(value(BookingStatus.CANCELLED), total) };
};

export const getProviderDashboard = async () => {
  const visibleProvider = { deletedAt: null, user: { deletedAt: null } };
  const topGroups = await prisma.booking.groupBy({ by: ['providerId'], where: { status: BookingStatus.COMPLETED, provider: visibleProvider }, _count: { id: true }, _sum: { totalAmount: true }, orderBy: { _count: { id: 'desc' } }, take: 5 });
  const ids = topGroups.map((group) => group.providerId);
  const [totals, profiles] = await Promise.all([
    Promise.all([
      prisma.providerProfile.count({ where: visibleProvider }),
      prisma.providerProfile.count({ where: { ...visibleProvider, status: ProviderStatus.APPROVED } }),
      prisma.providerProfile.count({ where: { ...visibleProvider, status: ProviderStatus.PENDING } }),
      prisma.providerProfile.count({ where: { ...visibleProvider, status: ProviderStatus.REJECTED } }),
      prisma.providerProfile.count({ where: { ...visibleProvider, services: { some: { deletedAt: null } } } }),
      prisma.providerProfile.count({ where: { ...visibleProvider, bookings: { some: { status: BookingStatus.COMPLETED } } } }),
    ]),
    prisma.providerProfile.findMany({ where: { id: { in: ids } }, select: { id: true, businessName: true } }),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const topProviders = await Promise.all(topGroups.map(async (group) => {
    const review = await prisma.review.aggregate({ where: { deletedAt: null, booking: { providerId: group.providerId } }, _avg: { rating: true }, _count: { id: true } });
    return { providerId: group.providerId, businessName: profilesById.get(group.providerId)?.businessName ?? 'Deleted provider', completedBookings: group._count.id, totalRevenue: money(group._sum.totalAmount), averageRating: review._avg.rating ? Number(review._avg.rating.toFixed(2)) : 0, reviewCount: review._count.id };
  }));
  return { totalProviders: totals[0], approvedProviders: totals[1], pendingProviders: totals[2], rejectedProviders: totals[3], providersWithServices: totals[4], providersWithCompletedBookings: totals[5], topProviders };
};

const serviceMetrics = async (serviceId: string) => {
  const [bookingCount, completedBookingCount, review] = await Promise.all([
    prisma.booking.count({ where: { serviceId } }),
    prisma.booking.count({ where: { serviceId, status: BookingStatus.COMPLETED } }),
    prisma.review.aggregate({ where: { serviceId, deletedAt: null }, _avg: { rating: true }, _count: { id: true } }),
  ]);
  return { bookingCount, completedBookingCount, averageRating: review._avg.rating ? Number(review._avg.rating.toFixed(2)) : 0, reviewCount: review._count.id };
};

export const getServiceDashboard = async () => {
  const visibleService = { deletedAt: null };
  const [totals, bookingGroups, ratingGroups] = await Promise.all([
    Promise.all([
      prisma.service.count({ where: visibleService }),
      prisma.service.count({ where: { ...visibleService, status: ServiceStatus.ACTIVE } }),
      prisma.service.count({ where: { ...visibleService, status: ServiceStatus.INACTIVE } }),
      prisma.service.count({ where: { ...visibleService, bookings: { some: {} } } }),
    ]),
    prisma.booking.groupBy({ by: ['serviceId'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    prisma.review.groupBy({ by: ['serviceId'], where: { deletedAt: null }, _avg: { rating: true }, _count: { id: true }, orderBy: { _avg: { rating: 'desc' } }, take: 10 }),
  ]);
  const candidateIds = [...new Set([...bookingGroups.map((group) => group.serviceId), ...ratingGroups.map((group) => group.serviceId)])];
  const services = await prisma.service.findMany({ where: { id: { in: candidateIds }, deletedAt: null }, select: { id: true, title: true } });
  const names = new Map(services.map((service) => [service.id, service.title]));
  const asRanked = async (ids: string[]) => Promise.all(ids.filter((id) => names.has(id)).slice(0, 5).map(async (serviceId) => ({ serviceId, title: names.get(serviceId)!, ...(await serviceMetrics(serviceId)) })));
  return { totalServices: totals[0], activeServices: totals[1], inactiveServices: totals[2], servicesWithBookings: totals[3], mostBookedServices: await asRanked(bookingGroups.map((group) => group.serviceId)), highestRatedServices: await asRanked(ratingGroups.map((group) => group.serviceId)) };
};

export const getRecentActivity = (limit: number) => prisma.auditLog.findMany({ take: limit, orderBy: { createdAt: 'desc' }, select: activitySelect });

const auditSelect = { ...activitySelect, userId: true, oldData: true, newData: true, ipAddress: true, userAgent: true } as const;
const safeAudit = <T extends { oldData: unknown; newData: unknown }>(audit: T) => ({ ...audit, oldData: sanitizeAuditData(audit.oldData), newData: sanitizeAuditData(audit.newData) });

export const listAuditLogs = async (query: AuditLogQuery) => {
  const where = { ...createdAtFilter(query), ...(query.action ? { action: query.action } : {}), ...(query.entityType ? { entityType: query.entityType } : {}), ...(query.entityId ? { entityId: query.entityId } : {}), ...(query.userId ? { userId: query.userId } : {}) };
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: query.sortOrder }, skip: (query.page - 1) * query.limit, take: query.limit, select: auditSelect }),
  ]);
  return pageData(rows.map(safeAudit), total, query.page, query.limit);
};

export const getAuditLog = async (id: string) => {
  const audit = await prisma.auditLog.findUnique({ where: { id }, select: auditSelect });
  if (!audit) throw new AppError(404, 'Audit log not found');
  return safeAudit(audit);
};
