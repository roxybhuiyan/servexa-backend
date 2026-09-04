import type { RequestHandler } from 'express';
import Stripe from 'stripe';
import sendResponse from '../../../shared/sendResponse.js';
import AppError from '../../errors/AppError.js';
import { requireRouteId } from '../Category/category.controller.js';
import { finalizeCheckout, getPaymentStatus, initiatePayment, markPaymentFailed } from './payment.service.js';
import { getStripe } from './stripe.service.js';

const userId = (req: Parameters<RequestHandler>[0]) => { if (!req.user) throw new AppError(401, 'Authentication is required'); return req.user.id; };
const context = (req: Parameters<RequestHandler>[0]) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined });
export const initiate: RequestHandler = async (req, res, next) => { try { sendResponse(res, { statusCode: 201, message: 'Payment session created', data: await initiatePayment(userId(req), requireRouteId(req.params.bookingId), context(req)) }); } catch (error) { next(error); } };
export const status: RequestHandler = async (req, res, next) => { try { sendResponse(res, { statusCode: 200, message: 'Payment status retrieved', data: await getPaymentStatus(userId(req), requireRouteId(req.params.bookingId)) }); } catch (error) { next(error); } };
export const webhook: RequestHandler = async (req, res, next) => {
  let stage = 'request validation';
  let eventId: string | undefined;
  let eventType: string | undefined;

  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) {
      throw new AppError(400, 'Invalid Stripe webhook request');
    }

    stage = 'signature verification';
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new AppError(503, 'Stripe webhook is not configured');
    const event = getStripe().webhooks.constructEvent(req.body, signature, secret);
    eventId = event.id;
    eventType = event.type;

    if (event.type === 'checkout.session.completed') {
      stage = 'checkout finalization';
      await finalizeCheckout(event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === 'payment_intent.payment_failed') {
      stage = 'payment failure finalization';
      await markPaymentFailed((event.data.object as Stripe.PaymentIntent).id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    console.error('[stripe-webhook] processing-failed', {
      stage,
      eventId,
      eventType,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorCode,
    });
    next(error);
  }
};
