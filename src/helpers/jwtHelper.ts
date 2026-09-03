import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { UserRole } from '../generated/prisma/enums.js';
import config from '../config/index.js';
import AppError from '../app/errors/AppError.js';

export type AuthTokenPayload = JwtPayload & {
  userId: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
};

type TokenClaims = {
  userId: string;
  role: UserRole;
};

const getSecret = (secret: string | undefined, name: string): string => {
  if (!secret) {
    throw new AppError(500, `${name} is not configured`);
  }

  return secret;
};

const toExpiresIn = (value: string): SignOptions['expiresIn'] => value as SignOptions['expiresIn'];

const parseToken = (
  token: string,
  secret: string,
  tokenType: AuthTokenPayload['tokenType'],
): AuthTokenPayload => {
  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string' ||
      !Object.values(UserRole).includes(payload.role as UserRole) ||
      payload.tokenType !== tokenType
    ) {
      throw new AppError(401, 'Invalid token');
    }

    return payload as AuthTokenPayload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'Invalid or expired token');
  }
};

export const generateAccessToken = (claims: TokenClaims): string =>
  jwt.sign(
    { ...claims, tokenType: 'access' },
    getSecret(config.jwt.accessSecret, 'JWT_ACCESS_SECRET'),
    { expiresIn: toExpiresIn(config.jwt.accessExpiresIn) },
  );

export const generateRefreshToken = (claims: TokenClaims): string =>
  jwt.sign(
    { ...claims, tokenType: 'refresh' },
    getSecret(config.jwt.refreshSecret, 'JWT_REFRESH_SECRET'),
    { expiresIn: toExpiresIn(config.jwt.refreshExpiresIn) },
  );

export const verifyAccessToken = (token: string): AuthTokenPayload =>
  parseToken(token, getSecret(config.jwt.accessSecret, 'JWT_ACCESS_SECRET'), 'access');

export const verifyRefreshToken = (token: string): AuthTokenPayload =>
  parseToken(token, getSecret(config.jwt.refreshSecret, 'JWT_REFRESH_SECRET'), 'refresh');

export const getTokenExpiryDate = (token: string): Date => {
  const payload = jwt.decode(token);

  if (typeof payload === 'string' || !payload?.exp) {
    throw new AppError(500, 'Unable to determine token expiration');
  }

  return new Date(payload.exp * 1000);
};
