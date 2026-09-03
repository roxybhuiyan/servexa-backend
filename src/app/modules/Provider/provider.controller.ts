import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import {
  getMyProviderProfile,
  getPublicProviderProfile,
  updateMyProviderProfile,
} from './provider.service.js';
import { updateProviderProfileValidationSchema } from './provider.validation.js';

const auditContext = (req: Parameters<RequestHandler>[0]) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

const routeId = (value: string | string[] | undefined): string => {
  if (typeof value !== 'string') throw new AppError(400, 'Invalid provider id');

  return value;
};

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const profile = await getMyProviderProfile(req.user.id);
    sendResponse(res, { statusCode: 200, message: 'Provider profile retrieved', data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const payload = updateProviderProfileValidationSchema.parse(req.body);
    const profile = await updateMyProviderProfile(req.user.id, payload, auditContext(req));
    sendResponse(res, { statusCode: 200, message: 'Provider profile updated', data: profile });
  } catch (error) {
    next(error);
  }
};

export const getPublicProfile: RequestHandler = async (req, res, next) => {
  try {
    const profile = await getPublicProviderProfile(routeId(req.params.id));
    sendResponse(res, { statusCode: 200, message: 'Provider profile retrieved', data: profile });
  } catch (error) {
    next(error);
  }
};
