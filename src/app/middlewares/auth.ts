import type { RequestHandler } from 'express';

import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { verifyAccessToken } from '../../helpers/jwtHelper.js';
import prisma from '../../lib/prisma.js';
import AppError from '../errors/AppError.js';

const auth =
  (...allowedRoles: UserRole[]): RequestHandler =>
  async (req, _res, next) => {
    try {
      const authorization = req.headers.authorization;

      if (!authorization?.startsWith('Bearer ')) {
        throw new AppError(401, 'Authentication is required');
      }

      const token = authorization.slice('Bearer '.length).trim();
      if (!token) {
        throw new AppError(401, 'Authentication is required');
      }

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findFirst({
        where: {
          id: payload.userId,
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        throw new AppError(401, 'Authentication is required');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        throw new AppError(403, 'You do not have permission to access this resource');
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

export default auth;
