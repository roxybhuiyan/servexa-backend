import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true, message: 'Must be an ISO 8601 datetime with an offset' });
const optionalIsoDateTime = isoDateTime.optional();

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const availabilityIdValidationSchema = z.object({
  id: z.string().trim().min(1),
});

export const createAvailabilityValidationSchema = z
  .object({
    serviceId: z.string().trim().min(1),
    startTime: isoDateTime,
    endTime: isoDateTime,
  })
  .strict();

export const updateAvailabilityValidationSchema = z
  .object({
    serviceId: z.string().trim().min(1).optional(),
    startTime: optionalIsoDateTime,
    endTime: optionalIsoDateTime,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const providerAvailabilityListValidationSchema = z.object({
  serviceId: z.string().trim().min(1).optional(),
  from: optionalIsoDateTime,
  to: optionalIsoDateTime,
  isBooked: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  ...pagination,
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const publicAvailabilityListValidationSchema = z.object({
  from: optionalIsoDateTime,
  to: optionalIsoDateTime,
  ...pagination,
});
