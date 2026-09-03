import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { getPublicCategories } from './category.service.js';

export const listPublicCategories: RequestHandler = async (_req, res, next) => {
  try {
    const categories = await getPublicCategories();
    sendResponse(res, { statusCode: 200, message: 'Categories retrieved', data: categories });
  } catch (error) {
    next(error);
  }
};

export const requireRouteId = (value: string | string[] | undefined): string => {
  if (typeof value !== 'string') throw new AppError(400, 'Invalid resource id');
  return value;
};
