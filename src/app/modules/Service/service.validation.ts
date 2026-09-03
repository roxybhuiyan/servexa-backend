import { z } from 'zod';

import { ServiceStatus } from '../../../generated/prisma/enums.js';

const priceSchema = z
  .union([
    z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Price must have at most two decimal places'),
    z.number().finite().positive(),
  ])
  .transform((value) => String(value))
  .refine((value) => Number(value) > 0, 'Price must be greater than zero');

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const publicServiceListValidationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(200).optional(),
  provider: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  minPrice: priceSchema.optional(),
  maxPrice: priceSchema.optional(),
  sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const providerServiceListValidationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createServiceValidationSchema = z
  .object({
    categoryId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(150),
    description: optionalText(5000),
    price: priceSchema,
    duration: z.coerce.number().int().positive().max(1440),
    imageUrl: optionalText(2048),
    serviceArea: optionalText(250),
    status: z.nativeEnum(ServiceStatus).optional(),
  })
  .strict();

export const updateServiceValidationSchema = z
  .object({
    categoryId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(2).max(150).optional(),
    description: optionalText(5000),
    price: priceSchema.optional(),
    duration: z.coerce.number().int().positive().max(1440).optional(),
    imageUrl: optionalText(2048),
    serviceArea: optionalText(250),
    status: z.nativeEnum(ServiceStatus).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
