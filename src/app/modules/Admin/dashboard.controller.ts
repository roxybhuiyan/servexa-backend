import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { getAuditLog, getBookingDashboard, getDashboardOverview, getProviderDashboard, getRecentActivity, getRevenueDashboard, getServiceDashboard, listAuditLogs } from './dashboard.service.js';
import { auditLogListValidationSchema, bookingDashboardValidationSchema, recentActivityValidationSchema, revenueDashboardValidationSchema } from './dashboard.validation.js';

const routeId = (value: string | string[] | undefined) => {
  if (typeof value !== 'string') throw new AppError(400, 'Invalid resource id');
  return value;
};

const respond = (message: string, getData: (req: Parameters<RequestHandler>[0]) => Promise<unknown>): RequestHandler => async (req, res, next) => {
  try { sendResponse(res, { statusCode: 200, message, data: await getData(req) }); } catch (error) { next(error); }
};

export const overview = respond('Dashboard overview retrieved', () => getDashboardOverview());
export const revenue = respond('Revenue dashboard retrieved', (req) => getRevenueDashboard(revenueDashboardValidationSchema.parse(req.query)));
export const bookings = respond('Booking dashboard retrieved', (req) => getBookingDashboard(bookingDashboardValidationSchema.parse(req.query)));
export const providers = respond('Provider dashboard retrieved', () => getProviderDashboard());
export const services = respond('Service dashboard retrieved', () => getServiceDashboard());
export const recentActivity = respond('Recent activity retrieved', (req) => getRecentActivity(recentActivityValidationSchema.parse(req.query).limit));
export const auditLogs = respond('Audit logs retrieved', (req) => listAuditLogs(auditLogListValidationSchema.parse(req.query)));
export const auditLog = respond('Audit log retrieved', (req) => getAuditLog(routeId(req.params.id)));

