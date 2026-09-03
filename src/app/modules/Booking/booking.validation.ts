import { z } from 'zod';

import { BookingStatus } from '../../../generated/prisma/enums.js';

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const bookingIdValidationSchema = z.object({ id: z.string().trim().min(1) });

export const createBookingValidationSchema = z
  .object({
    serviceId: z.string().trim().min(1),
    slotId: z.string().trim().min(1),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const bookingListValidationSchema = z.object({
  ...pagination,
  status: z.nativeEnum(BookingStatus).optional(),
  serviceId: z.string().trim().min(1).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
