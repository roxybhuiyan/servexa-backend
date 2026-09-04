import { z } from 'zod';

const dateFields = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

const validateDateRange = (value: { from?: Date; to?: Date }, context: z.RefinementCtx) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'from must be before or equal to to', path: ['from'] });
  }
};

export const revenueDashboardValidationSchema = z.object({
  ...dateFields,
  providerId: z.string().trim().min(1).max(100).optional(),
  serviceId: z.string().trim().min(1).max(100).optional(),
}).superRefine(validateDateRange);

export const bookingDashboardValidationSchema = z.object({
  ...dateFields,
  providerId: z.string().trim().min(1).max(100).optional(),
  serviceId: z.string().trim().min(1).max(100).optional(),
  customerId: z.string().trim().min(1).max(100).optional(),
}).superRefine(validateDateRange);

export const recentActivityValidationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditLogListValidationSchema = z.object({
  ...dateFields,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().trim().min(1).max(100).optional(),
  userId: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).superRefine(validateDateRange);
