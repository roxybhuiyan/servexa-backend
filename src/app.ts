import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';

import AppError from './app/errors/AppError.js';
import helmet from 'helmet';

import apiV1Router from './app/routes/index.js';
import { webhook as stripeWebhook } from './app/modules/Payment/payment.controller.js';
import sendResponse from './shared/sendResponse.js';

const app = express();

app.use(helmet());
app.use(cors());
app.post('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    message: 'Servexa API is healthy',
    data: null,
  });
});

app.get('/payments/success', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    message: 'Payment completed. Final status is confirmed by Stripe webhook.',
    data: null,
  });
});

app.get('/payments/cancel', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    message: 'Stripe Checkout was cancelled. Payment status was not changed by this redirect.',
    data: null,
  });
});

app.use('/api/v1', apiV1Router);

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.details ? [error.details] : [],
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
  });
});

export default app;
