import { ProviderStatus, UserStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type AuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

const providerSelfSelect = {
  id: true,
  businessName: true,
  bio: true,
  phone: true,
  city: true,
  address: true,
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

export const getMyProviderProfile = async (userId: string) => {
  const profile = await prisma.providerProfile.findFirst({
    where: { userId, deletedAt: null, user: { deletedAt: null, status: UserStatus.ACTIVE } },
    select: providerSelfSelect,
  });

  if (!profile) {
    throw new AppError(404, 'Provider profile not found');
  }

  return profile;
};

export const updateMyProviderProfile = async (
  userId: string,
  payload: {
    businessName?: string;
    bio?: string | null;
    phone?: string;
    city?: string;
    address?: string;
  },
  auditContext: AuditContext,
) => {
  const profile = await getMyProviderProfile(userId);

  return prisma.$transaction(async (transaction) => {
    const updatedProfile = await transaction.providerProfile.update({
      where: { id: profile.id },
      data: payload,
      select: providerSelfSelect,
    });

    await createAuditLog(transaction, {
      userId,
      action: 'PROVIDER_PROFILE_UPDATED',
      entityType: 'ProviderProfile',
      entityId: profile.id,
      oldData: {
        businessName: profile.businessName,
        bio: profile.bio,
        phone: profile.phone,
        city: profile.city,
        address: profile.address,
      },
      newData: payload,
      ...auditContext,
    });

    return updatedProfile;
  });
};

export const getPublicProviderProfile = async (providerId: string) => {
  const profile = await prisma.providerProfile.findFirst({
    where: {
      id: providerId,
      status: ProviderStatus.APPROVED,
      deletedAt: null,
      user: { deletedAt: null, status: UserStatus.ACTIVE },
    },
    select: {
      id: true,
      businessName: true,
      bio: true,
      city: true,
      address: true,
      rating: true,
      totalReviews: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      _count: { select: { services: true } },
    },
  });

  if (!profile) {
    throw new AppError(404, 'Provider not found');
  }

  return profile;
};
