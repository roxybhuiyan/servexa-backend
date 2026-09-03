import { z } from 'zod';

import { ProviderStatus, UserRole, UserStatus } from '../../../generated/prisma/enums.js';

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const listUsersValidationSchema = z.object({
  ...pagination,
  search: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const listProvidersValidationSchema = z.object({
  ...pagination,
  search: z.string().trim().min(1).max(100).optional(),
  status: z.nativeEnum(ProviderStatus).optional(),
  sortBy: z.enum(['createdAt', 'businessName', 'city', 'rating']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const userStatusValidationSchema = z.object({ status: z.nativeEnum(UserStatus) }).strict();

export const providerStatusValidationSchema = z
  .object({ status: z.nativeEnum(ProviderStatus) })
  .strict();
