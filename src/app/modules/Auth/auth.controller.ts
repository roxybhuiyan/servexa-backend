import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from './auth.service.js';
import {
  loginValidationSchema,
  logoutValidationSchema,
  refreshTokenValidationSchema,
  registerValidationSchema,
} from './auth.validation.js';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const payload = registerValidationSchema.parse(req.body);
    const user = await registerUser(payload);

    sendResponse(res, { statusCode: 201, message: 'Registration successful', data: user });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const payload = loginValidationSchema.parse(req.body);
    const tokens = await loginUser(payload);

    sendResponse(res, { statusCode: 200, message: 'Login successful', data: tokens });
  } catch (error) {
    next(error);
  }
};

export const refreshToken: RequestHandler = async (req, res, next) => {
  try {
    const payload = refreshTokenValidationSchema.parse(req.body);
    const tokens = await refreshAccessToken(payload);

    sendResponse(res, { statusCode: 200, message: 'Access token refreshed', data: tokens });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const payload = logoutValidationSchema.parse(req.body);
    await logoutUser(payload);

    sendResponse(res, { statusCode: 200, message: 'Logout successful', data: null });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication is required');
    }

    const user = await getCurrentUser(req.user.id);
    sendResponse(res, { statusCode: 200, message: 'Current user retrieved', data: user });
  } catch (error) {
    next(error);
  }
};
