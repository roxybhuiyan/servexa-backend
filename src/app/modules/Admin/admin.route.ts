import { Router } from 'express';

import { UserRole } from '../../../generated/prisma/enums.js';
import auth from '../../middlewares/auth.js';
import {
  createCategory,
  deleteCategory,
  deleteUser,
  getProviders,
  getUser,
  getUsers,
  getCategories,
  patchCategory,
  updateProviderStatus,
  updateUserStatus,
} from './admin.controller.js';
import { adminList, adminRemove } from '../Review/review.controller.js';
import { auditLog, auditLogs, bookings, overview, providers, recentActivity, revenue, services } from './dashboard.controller.js';

const adminRouter = Router();

adminRouter.use(auth(UserRole.ADMIN));
adminRouter.get('/dashboard/overview', overview);
adminRouter.get('/dashboard/revenue', revenue);
adminRouter.get('/dashboard/bookings', bookings);
adminRouter.get('/dashboard/providers', providers);
adminRouter.get('/dashboard/services', services);
adminRouter.get('/dashboard/recent-activity', recentActivity);
adminRouter.get('/audit-logs', auditLogs);
adminRouter.get('/audit-logs/:id', auditLog);
adminRouter.get('/users', getUsers);
adminRouter.get('/users/:id', getUser);
adminRouter.patch('/users/:id/status', updateUserStatus);
adminRouter.delete('/users/:id', deleteUser);
adminRouter.get('/providers', getProviders);
adminRouter.patch('/providers/:id/status', updateProviderStatus);
adminRouter.get('/categories', getCategories);
adminRouter.post('/categories', createCategory);
adminRouter.patch('/categories/:id', patchCategory);
adminRouter.delete('/categories/:id', deleteCategory);
adminRouter.get('/reviews', adminList);
adminRouter.delete('/reviews/:id', adminRemove);

export default adminRouter;
