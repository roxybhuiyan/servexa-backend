import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import {
  changeProviderStatus,
  changeUserStatus,
  getAdminUser,
  listProviders,
  listUsers,
  softDeleteUser,
} from './admin.service.js';
import {
  listProvidersValidationSchema,
  listUsersValidationSchema,
  providerStatusValidationSchema,
  userStatusValidationSchema,
} from './admin.validation.js';
import {
  createCategory as createCategoryRecord,
  getAdminCategories,
  softDeleteCategory,
  updateCategory,
} from '../Category/category.service.js';
import {
  categoryListValidationSchema,
  createCategoryValidationSchema,
  updateCategoryValidationSchema,
} from '../Category/category.validation.js';
import { requireRouteId } from '../Category/category.controller.js';

const auditContext = (req: Parameters<RequestHandler>[0]) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

const routeId = (value: string | string[] | undefined): string => {
  if (typeof value !== 'string') throw new AppError(400, 'Invalid resource id');

  return value;
};

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const query = listUsersValidationSchema.parse(req.query);
    const result = await listUsers(query);
    sendResponse(res, { statusCode: 200, message: 'Users retrieved', data: result });
  } catch (error) {
    next(error);
  }
};

export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await getAdminUser(routeId(req.params.id));
    sendResponse(res, { statusCode: 200, message: 'User retrieved', data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const payload = userStatusValidationSchema.parse(req.body);
    const user = await changeUserStatus(
      req.user.id,
      routeId(req.params.id),
      payload.status,
      auditContext(req),
    );
    sendResponse(res, { statusCode: 200, message: 'User status updated', data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    await softDeleteUser(req.user.id, routeId(req.params.id), auditContext(req));
    sendResponse(res, { statusCode: 200, message: 'User deleted', data: null });
  } catch (error) {
    next(error);
  }
};

export const getProviders: RequestHandler = async (req, res, next) => {
  try {
    const query = listProvidersValidationSchema.parse(req.query);
    const result = await listProviders(query);
    sendResponse(res, { statusCode: 200, message: 'Providers retrieved', data: result });
  } catch (error) {
    next(error);
  }
};

export const updateProviderStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const payload = providerStatusValidationSchema.parse(req.body);
    const provider = await changeProviderStatus(
      req.user.id,
      routeId(req.params.id),
      payload.status,
      auditContext(req),
    );
    sendResponse(res, { statusCode: 200, message: 'Provider status updated', data: provider });
  } catch (error) {
    next(error);
  }
};

export const getCategories: RequestHandler = async (req, res, next) => {
  try {
    const result = await getAdminCategories(categoryListValidationSchema.parse(req.query));
    sendResponse(res, { statusCode: 200, message: 'Categories retrieved', data: result });
  } catch (error) {
    next(error);
  }
};

export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    const category = await createCategoryRecord(
      req.user.id,
      createCategoryValidationSchema.parse(req.body),
      auditContext(req),
    );
    sendResponse(res, { statusCode: 201, message: 'Category created', data: category });
  } catch (error) {
    next(error);
  }
};

export const patchCategory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    const category = await updateCategory(
      req.user.id,
      requireRouteId(req.params.id),
      updateCategoryValidationSchema.parse(req.body),
      auditContext(req),
    );
    sendResponse(res, { statusCode: 200, message: 'Category updated', data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');
    await softDeleteCategory(req.user.id, requireRouteId(req.params.id), auditContext(req));
    sendResponse(res, { statusCode: 200, message: 'Category deleted', data: null });
  } catch (error) {
    next(error);
  }
};
