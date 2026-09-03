import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { requireRouteId } from '../Category/category.controller.js';
import {
  createService,
  getPublicService,
  listMyServices,
  listPublicServices,
  softDeleteService,
  updateService,
} from './service.service.js';
import {
  createServiceValidationSchema,
  providerServiceListValidationSchema,
  publicServiceListValidationSchema,
  updateServiceValidationSchema,
} from './service.validation.js';

const auditContext = (req: Parameters<RequestHandler>[0]) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

export const listPublic: RequestHandler = async (req, res, next) => {
  try {
    sendResponse(res, {
      statusCode: 200,
      message: 'Services retrieved',
      data: await listPublicServices(publicServiceListValidationSchema.parse(req.query)),
    });
  } catch (error) {
    next(error);
  }
};
export const getPublic: RequestHandler = async (req, res, next) => {
  try {
    sendResponse(res, {
      statusCode: 200,
      message: 'Service retrieved',
      data: await getPublicService(requireRouteId(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
};
export const listMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    sendResponse(res, {
      statusCode: 200,
      message: 'Services retrieved',
      data: await listMyServices(req.user.id, providerServiceListValidationSchema.parse(req.query)),
    });
  } catch (error) {
    next(error);
  }
};
export const createMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    sendResponse(res, {
      statusCode: 201,
      message: 'Service created',
      data: await createService(
        req.user.id,
        createServiceValidationSchema.parse(req.body),
        auditContext(req),
      ),
    });
  } catch (error) {
    next(error);
  }
};
export const updateMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    sendResponse(res, {
      statusCode: 200,
      message: 'Service updated',
      data: await updateService(
        req.user.id,
        requireRouteId(req.params.id),
        updateServiceValidationSchema.parse(req.body),
        auditContext(req),
      ),
    });
  } catch (error) {
    next(error);
  }
};
export const deleteMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    await softDeleteService(req.user.id, requireRouteId(req.params.id), auditContext(req));
    sendResponse(res, { statusCode: 200, message: 'Service deleted', data: null });
  } catch (error) {
    next(error);
  }
};
