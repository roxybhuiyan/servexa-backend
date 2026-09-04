import { z } from 'zod';

const pagination = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(10) };
export const createReviewValidationSchema = z.object({ bookingId: z.string().trim().min(1), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional() }).strict();
export const updateReviewValidationSchema = z.object({ rating: z.number().int().min(1).max(5).optional(), comment: z.string().trim().max(2000).nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export const reviewListValidationSchema = z.object({ ...pagination, rating: z.coerce.number().int().min(1).max(5).optional(), sortOrder: z.enum(['asc', 'desc']).default('desc') });
export const adminReviewListValidationSchema = reviewListValidationSchema.extend({ customerId: z.string().trim().min(1).optional(), providerId: z.string().trim().min(1).optional(), serviceId: z.string().trim().min(1).optional(), search: z.string().trim().min(1).max(100).optional() });
