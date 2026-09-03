import { ProviderStatus, UserRole, UserStatus } from '../../../generated/prisma/enums.js';
import {
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiryDate,
  verifyRefreshToken,
} from '../../../helpers/jwtHelper.js';
import prisma from '../../../lib/prisma.js';
import { comparePassword, hashPassword } from '../../../utils/password.js';
import { hashToken } from '../../../utils/tokenHash.js';
import AppError from '../../errors/AppError.js';
import type { LoginInput, RefreshTokenInput, RegisterInput } from './auth.interface.js';

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
      status: true,
    },
  },
} as const;

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

const createTokenPair = (user: { id: string; role: UserRole }): TokenPair => {
  const claims = { userId: user.id, role: user.role };

  return {
    accessToken: generateAccessToken(claims),
    refreshToken: generateRefreshToken(claims),
  };
};

const storeRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getTokenExpiryDate(refreshToken),
    },
  });
};

export const registerUser = async (payload: RegisterInput) => {
  const email = payload.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const password = await hashPassword(payload.password);

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name: payload.name,
          email,
          password,
          phone: payload.phone,
          role: payload.role,
          ...(payload.role === UserRole.PROVIDER
            ? {
                providerProfile: {
                  create: {
                    businessName: payload.businessName,
                    bio: payload.bio,
                    phone: payload.phone,
                    city: payload.city,
                    address: payload.address,
                    status: ProviderStatus.PENDING,
                  },
                },
              }
            : {}),
        },
        select: safeUserSelect,
      });

      return user;
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new AppError(409, 'An account with this email already exists');
    }

    throw error;
  }
};

export const loginUser = async (payload: LoginInput): Promise<TokenPair> => {
  const email = payload.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      password: true,
      role: true,
      status: true,
    },
  });

  const invalidCredentials = new AppError(401, 'Invalid email or password');
  if (!user || !(await comparePassword(payload.password, user.password))) {
    throw invalidCredentials;
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, 'This account is not active');
  }

  const tokens = createTokenPair(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return tokens;
};

export const refreshAccessToken = async (payload: RefreshTokenInput): Promise<TokenPair> => {
  const claims = verifyRefreshToken(payload.refreshToken);
  const tokenHash = hashToken(payload.refreshToken);
  const now = new Date();

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
      user: { deletedAt: null, status: UserStatus.ACTIVE },
    },
    select: {
      id: true,
      user: { select: { id: true, role: true } },
    },
  });

  if (
    !storedToken ||
    storedToken.user.id !== claims.userId ||
    storedToken.user.role !== claims.role
  ) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const tokens = createTokenPair(storedToken.user);

  await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null },
      data: { revokedAt: now },
    });

    if (revoked.count !== 1) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    await transaction.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: getTokenExpiryDate(tokens.refreshToken),
      },
    });
  });

  return tokens;
};

export const logoutUser = async (payload: RefreshTokenInput): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(payload.refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
    select: safeUserSelect,
  });

  if (!user) {
    throw new AppError(401, 'Authentication is required');
  }

  return user;
};
