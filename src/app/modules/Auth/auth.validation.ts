import { z } from 'zod';

import { UserRole } from '../../../generated/prisma/enums.js';

const baseRegistration = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(5).max(30),
};

export const registerValidationSchema = z.discriminatedUnion('role', [
  z.object({
    ...baseRegistration,
    role: z.literal(UserRole.CUSTOMER),
  }),
  z.object({
    ...baseRegistration,
    role: z.literal(UserRole.PROVIDER),
    businessName: z.string().trim().min(2).max(150),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(500),
    bio: z.string().trim().max(2000).optional(),
  }),
]);

export const loginValidationSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const refreshTokenValidationSchema = refreshTokenSchema;
export const logoutValidationSchema = refreshTokenSchema;
