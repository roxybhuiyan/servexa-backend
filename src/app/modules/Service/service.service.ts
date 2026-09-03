import { Prisma } from '../../../generated/prisma/client.js';
import { ProviderStatus, ServiceStatus, UserStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type AuditContext = { ipAddress?: string; userAgent?: string };
type ServicePayload = {
  categoryId?: string;
  title?: string;
  description?: string | null;
  price?: string;
  duration?: number;
  imageUrl?: string | null;
  serviceArea?: string | null;
  status?: ServiceStatus;
};

const publicServiceSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  duration: true,
  imageUrl: true,
  serviceArea: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  provider: {
    select: {
      id: true,
      businessName: true,
      city: true,
      rating: true,
      totalReviews: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

const providerServiceSelect = {
  id: true,
  categoryId: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  duration: true,
  imageUrl: true,
  serviceArea: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

const publicVisibility: Prisma.ServiceWhereInput = {
  status: ServiceStatus.ACTIVE,
  deletedAt: null,
  category: { deletedAt: null },
  provider: {
    status: ProviderStatus.APPROVED,
    deletedAt: null,
    user: { status: UserStatus.ACTIVE, deletedAt: null },
  },
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findProviderForMutation = async (userId: string) => {
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

const ensureCategory = async (categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new AppError(404, 'Category not found');
};

const nextServiceSlug = async (title: string, providerId: string, excludeId?: string) => {
  const base = `${slugify(title)}-${providerId.slice(-8)}`;
  for (let sequence = 1; sequence < 1000; sequence += 1) {
    const slug = sequence === 1 ? base : `${base}-${sequence}`;
    const existing = await prisma.service.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new AppError(409, 'Unable to generate a unique service slug');
};

const pageData = <T>(data: T[], total: number, page: number, limit: number) => ({
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  data,
});

export const listPublicServices = async (query: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  provider?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy: 'createdAt' | 'price' | 'title';
  sortOrder: 'asc' | 'desc';
}) => {
  if (
    query.minPrice &&
    query.maxPrice &&
    new Prisma.Decimal(query.minPrice).gt(new Prisma.Decimal(query.maxPrice))
  ) {
    throw new AppError(400, 'minPrice cannot exceed maxPrice');
  }
  const conditions: Prisma.ServiceWhereInput[] = [publicVisibility];
  if (query.search) {
    conditions.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (query.category)
    conditions.push({ category: { OR: [{ id: query.category }, { slug: query.category }] } });
  if (query.provider) conditions.push({ providerId: query.provider });
  if (query.city)
    conditions.push({ provider: { city: { equals: query.city, mode: 'insensitive' } } });
  if (query.minPrice || query.maxPrice) {
    conditions.push({
      price: {
        ...(query.minPrice ? { gte: query.minPrice } : {}),
        ...(query.maxPrice ? { lte: query.maxPrice } : {}),
      },
    });
  }
  const where: Prisma.ServiceWhereInput = { AND: conditions };
  const [total, data] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      select: publicServiceSelect,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
  ]);
  return pageData(data, total, query.page, query.limit);
};

export const getPublicService = async (serviceId: string) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, ...publicVisibility },
    select: publicServiceSelect,
  });
  if (!service) throw new AppError(404, 'Service not found');
  return service;
};

export const listMyServices = async (
  userId: string,
  query: {
    page: number;
    limit: number;
    search?: string;
    status?: ServiceStatus;
    sortBy: 'createdAt' | 'price' | 'title';
    sortOrder: 'asc' | 'desc';
  },
) => {
  const provider = await prisma.providerProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!provider) throw new AppError(404, 'Provider profile not found');
  const where: Prisma.ServiceWhereInput = {
    providerId: provider.id,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, data] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      select: providerServiceSelect,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
  ]);
  return pageData(data, total, query.page, query.limit);
};

export const createService = async (
  userId: string,
  payload: Required<Pick<ServicePayload, 'categoryId' | 'title' | 'price' | 'duration'>> &
    ServicePayload,
  context: AuditContext,
) => {
  const provider = await findProviderForMutation(userId);
  await ensureCategory(payload.categoryId);
  const slug = await nextServiceSlug(payload.title, provider.id);
  return prisma.$transaction(async (transaction) => {
    const service = await transaction.service.create({
      data: {
        ...payload,
        providerId: provider.id,
        slug,
        status: payload.status ?? ServiceStatus.ACTIVE,
      },
      select: providerServiceSelect,
    });
    await createAuditLog(transaction, {
      userId,
      action: 'SERVICE_CREATED',
      entityType: 'Service',
      entityId: service.id,
      newData: {
        title: service.title,
        categoryId: service.categoryId,
        price: service.price.toString(),
        status: service.status,
      },
      ...context,
    });
    return service;
  });
};

const findOwnedService = async (userId: string, serviceId: string) => {
  const provider = await prisma.providerProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!provider) throw new AppError(404, 'Provider profile not found');
  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId: provider.id, deletedAt: null },
    select: providerServiceSelect,
  });
  if (!service) throw new AppError(404, 'Service not found');
  return { provider, service };
};

export const updateService = async (
  userId: string,
  serviceId: string,
  payload: ServicePayload,
  context: AuditContext,
) => {
  const { provider, service } = await findOwnedService(userId, serviceId);
  if (payload.categoryId) await ensureCategory(payload.categoryId);
  const slug =
    payload.title && payload.title !== service.title
      ? await nextServiceSlug(payload.title, provider.id, serviceId)
      : service.slug;
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.service.update({
      where: { id: serviceId },
      data: { ...payload, slug },
      select: providerServiceSelect,
    });
    await createAuditLog(transaction, {
      userId,
      action: 'SERVICE_UPDATED',
      entityType: 'Service',
      entityId: serviceId,
      oldData: {
        title: service.title,
        categoryId: service.categoryId,
        price: service.price.toString(),
        status: service.status,
      },
      newData: {
        title: updated.title,
        categoryId: updated.categoryId,
        price: updated.price.toString(),
        status: updated.status,
      },
      ...context,
    });
    return updated;
  });
};

export const softDeleteService = async (
  userId: string,
  serviceId: string,
  context: AuditContext,
) => {
  const { service } = await findOwnedService(userId, serviceId);
  await prisma.$transaction(async (transaction) => {
    await transaction.service.update({ where: { id: serviceId }, data: { deletedAt: new Date() } });
    await createAuditLog(transaction, {
      userId,
      action: 'SERVICE_SOFT_DELETED',
      entityType: 'Service',
      entityId: serviceId,
      oldData: { title: service.title, status: service.status, deletedAt: null },
      newData: { deleted: true },
      ...context,
    });
  });
};
