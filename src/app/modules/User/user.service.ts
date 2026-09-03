import { UserStatus } from '../../../generated/prisma/enums.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

const safeUserSelect = {
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
      bio: true,
      phone: true,
      city: true,
      address: true,
      status: true,
      rating: true,
      totalReviews: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
    select: safeUserSelect,
  });

  if (!user) {
    throw new AppError(401, 'Authentication is required');
  }

  return user;
};

export const updateMyProfile = async (
  userId: string,
  payload: { name?: string; phone?: string },
) => {
  const updatedUser = await prisma.user.updateMany({
    where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
    data: payload,
  });

  if (updatedUser.count !== 1) {
    throw new AppError(401, 'Authentication is required');
  }

  return getMyProfile(userId);
};
