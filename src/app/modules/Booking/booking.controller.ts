import type { RequestHandler } from 'express';

import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { requireRouteId } from '../Category/category.controller.js';
import { acceptBooking, cancelBooking, completeBooking, createBooking, getCustomerBooking, getProviderBooking, listCustomerBookings, listProviderBookings, rejectBooking, startBooking } from './booking.service.js';
import { bookingListValidationSchema, createBookingValidationSchema } from './booking.validation.js';

const actor = (req: Parameters<RequestHandler>[0]) => { if (!req.user) throw new AppError(401, 'Authentication is required'); return req.user.id; };
const context = (req: Parameters<RequestHandler>[0]) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined });
const respond = (handler: (req: Parameters<RequestHandler>[0]) => Promise<unknown>, message: string, statusCode = 200): RequestHandler => async (req, res, next) => { try { sendResponse(res, { statusCode, message, data: await handler(req) }); } catch (error) { next(error); } };

export const create: RequestHandler = respond((req) => createBooking(actor(req), createBookingValidationSchema.parse(req.body), context(req)), 'Booking created', 201);
export const listMine: RequestHandler = respond((req) => listCustomerBookings(actor(req), bookingListValidationSchema.parse(req.query)), 'Bookings retrieved');
export const getMine: RequestHandler = respond((req) => getCustomerBooking(actor(req), requireRouteId(req.params.id)), 'Booking retrieved');
export const cancel: RequestHandler = respond((req) => cancelBooking(actor(req), requireRouteId(req.params.id), context(req)), 'Booking cancelled');
export const listProviderMine: RequestHandler = respond((req) => listProviderBookings(actor(req), bookingListValidationSchema.parse(req.query)), 'Bookings retrieved');
export const getProviderMine: RequestHandler = respond((req) => getProviderBooking(actor(req), requireRouteId(req.params.id)), 'Booking retrieved');
export const accept: RequestHandler = respond((req) => acceptBooking(actor(req), requireRouteId(req.params.id), context(req)), 'Booking accepted');
export const reject: RequestHandler = respond((req) => rejectBooking(actor(req), requireRouteId(req.params.id), context(req)), 'Booking rejected');
export const start: RequestHandler = respond((req) => startBooking(actor(req), requireRouteId(req.params.id), context(req)), 'Booking started');
export const complete: RequestHandler = respond((req) => completeBooking(actor(req), requireRouteId(req.params.id), context(req)), 'Booking completed');
