import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens');

export const categoryListValidationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
});

export const createCategoryValidationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: slugSchema.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const updateCategoryValidationSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
