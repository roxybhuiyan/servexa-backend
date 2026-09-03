import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { requireRouteId } from '../Category/category.controller.js';
import { createAvailability, deleteAvailability, listMyAvailability, listPublicAvailability, updateAvailability } from './availability.service.js';
import { createAvailabilityValidationSchema, providerAvailabilityListValidationSchema, publicAvailabilityListValidationSchema, updateAvailabilityValidationSchema } from './availability.validation.js';

const auditContext = (req: Parameters<RequestHandler>[0]) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined });
const userId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user) throw new AppError(401, 'Authentication is required');
  return req.user.id;
};

export const listMine: RequestHandler = async (req, res, next) => { try {
  sendResponse(res, { statusCode: 200, message: 'Availability slots retrieved', data: await listMyAvailability(userId(req), providerAvailabilityListValidationSchema.parse(req.query)) });
} catch (error) { next(error); } };
export const createMine: RequestHandler = async (req, res, next) => { try {
  sendResponse(res, { statusCode: 201, message: 'Availability slot created', data: await createAvailability(userId(req), createAvailabilityValidationSchema.parse(req.body), auditContext(req)) });
} catch (error) { next(error); } };
export const updateMine: RequestHandler = async (req, res, next) => { try {
  sendResponse(res, { statusCode: 200, message: 'Availability slot updated', data: await updateAvailability(userId(req), requireRouteId(req.params.id), updateAvailabilityValidationSchema.parse(req.body), auditContext(req)) });
} catch (error) { next(error); } };
export const deleteMine: RequestHandler = async (req, res, next) => { try {
  await deleteAvailability(userId(req), requireRouteId(req.params.id), auditContext(req));
  sendResponse(res, { statusCode: 200, message: 'Availability slot deleted', data: null });
} catch (error) { next(error); } };
export const listPublic: RequestHandler = async (req, res, next) => { try {
  sendResponse(res, { statusCode: 200, message: 'Available slots retrieved', data: await listPublicAvailability(requireRouteId(req.params.serviceId), publicAvailabilityListValidationSchema.parse(req.query)) });
} catch (error) { next(error); } };
