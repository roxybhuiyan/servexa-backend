import Stripe from 'stripe';

import config from '../../../config/index.js';
import AppError from '../../errors/AppError.js';

let stripe: Stripe | undefined;

export const getStripe = (): Stripe => {
  if (!config.stripe.secretKey) throw new AppError(503, 'Stripe payments are not configured');
  stripe ??= new Stripe(config.stripe.secretKey);
  return stripe;
};

export const toStripeAmount = (amount: { mul: (value: number) => { toFixed: (digits: number) => string } }): number => {
  const value = amount.mul(100).toFixed(0);
  if (!/^\d+$/.test(value) || Number(value) > Number.MAX_SAFE_INTEGER) throw new AppError(400, 'Invalid payment amount');
  return Number(value);
};
