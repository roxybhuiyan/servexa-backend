import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { getMyProfile, updateMyProfile } from './user.service.js';
import { updateMyProfileValidationSchema } from './user.validation.js';

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const user = await getMyProfile(req.user.id);
    sendResponse(res, { statusCode: 200, message: 'Profile retrieved', data: user });
  } catch (error) {
    next(error);
  }
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication is required');

    const payload = updateMyProfileValidationSchema.parse(req.body);
    const user = await updateMyProfile(req.user.id, payload);
    sendResponse(res, { statusCode: 200, message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};
