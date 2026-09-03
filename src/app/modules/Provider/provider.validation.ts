import { z } from 'zod';

export const updateProviderProfileValidationSchema = z
  .object({
    businessName: z.string().trim().min(2).max(150).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    phone: z.string().trim().min(5).max(30).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    address: z.string().trim().min(5).max(500).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
