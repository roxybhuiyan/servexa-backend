import { ProviderStatus, UserRole, UserStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type AuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

type ListUsersInput = {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy: 'createdAt' | 'name' | 'email';
  sortOrder: 'asc' | 'desc';
};

type ListProvidersInput = {
  page: number;
  limit: number;
  search?: string;
  status?: ProviderStatus;
  sortBy: 'createdAt' | 'businessName' | 'city' | 'rating';
  sortOrder: 'asc' | 'desc';
};

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  providerProfile: {
    select: {
      id: true,
      businessName: true,
      status: true,
      city: true,
      rating: true,
      totalReviews: true,
    },
  },
} as const;

const adminProviderSelect = {
  id: true,
  businessName: true,
  city: true,
  status: true,
  rating: true,
  totalReviews: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  },
} as const;

const toPageData = <T>(data: T[], total: number, page: number, limit: number) => ({
  meta: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
  data,
});

export const listUsers = async (query: ListUsersInput) => {
  const where = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
  ]);

  return toPageData(users, total, query.page, query.limit);
};

export const getAdminUser = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: adminUserSelect,
  });

  if (!user) throw new AppError(404, 'User not found');

  return user;
};

export const changeUserStatus = async (
  actorId: string,
  userId: string,
  status: UserStatus,
  auditContext: AuditContext,
) => {
  if (actorId === userId && status !== UserStatus.ACTIVE) {
    throw new AppError(400, 'Administrators cannot suspend or block themselves');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!user) throw new AppError(404, 'User not found');

  if (user.status === status) {
    throw new AppError(400, 'User already has this status');
  }

  return prisma.$transaction(async (transaction) => {
    const updatedUser = await transaction.user.update({
      where: { id: userId },
      data: { status },
      select: adminUserSelect,
    });

    await createAuditLog(transaction, {
      userId: actorId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: userId,
      oldData: { status: user.status },
      newData: { status },
      ...auditContext,
    });

    return updatedUser;
  });
};

export const softDeleteUser = async (
  actorId: string,
  userId: string,
  auditContext: AuditContext,
) => {
  if (actorId === userId) {
    throw new AppError(400, 'Administrators cannot delete themselves');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw new AppError(404, 'User not found');

  const deletedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: userId }, data: { deletedAt } });

    if (user.role === UserRole.PROVIDER) {
      await transaction.providerProfile.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt },
      });
    }

    await createAuditLog(transaction, {
      userId: actorId,
      action: 'USER_SOFT_DELETED',
      entityType: 'User',
      entityId: userId,
      oldData: { status: user.status, deletedAt: null },
      newData: { deletedAt: deletedAt.toISOString() },
      ...auditContext,
    });
  });
};

export const listProviders = async (query: ListProvidersInput) => {
  const where = {
    deletedAt: null,
    user: { deletedAt: null },
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { businessName: { contains: query.search, mode: 'insensitive' as const } },
            { city: { contains: query.search, mode: 'insensitive' as const } },
            { user: { name: { contains: query.search, mode: 'insensitive' as const } } },
            { user: { email: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, providers] = await prisma.$transaction([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where,
      select: adminProviderSelect,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
  ]);

  return toPageData(providers, total, query.page, query.limit);
};

export const changeProviderStatus = async (
  actorId: string,
  providerId: string,
  status: ProviderStatus,
  auditContext: AuditContext,
) => {
  const profile = await prisma.providerProfile.findFirst({
    where: { id: providerId, deletedAt: null, user: { deletedAt: null } },
    select: { id: true, status: true, user: { select: { id: true, status: true } } },
  });
  if (!profile) throw new AppError(404, 'Provider not found');

  if (profile.user.status !== UserStatus.ACTIVE) {
    throw new AppError(400, 'Provider user must be active before status can be changed');
  }

  if (profile.status === status) {
    throw new AppError(400, 'Provider already has this status');
  }

  return prisma.$transaction(async (transaction) => {
    const updatedProfile = await transaction.providerProfile.update({
      where: { id: providerId },
      data: { status },
      select: adminProviderSelect,
    });

    await createAuditLog(transaction, {
      userId: actorId,
      action: 'PROVIDER_STATUS_CHANGED',
      entityType: 'ProviderProfile',
      entityId: providerId,
      oldData: { status: profile.status },
      newData: { status },
      ...auditContext,
    });

    return updatedProfile;
  });
};
