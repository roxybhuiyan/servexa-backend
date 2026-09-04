import { BookingStatus, PaymentProvider, PaymentStatus } from '../../../generated/prisma/enums.js';
import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import config from '../../../config/index.js';
import AppError from '../../errors/AppError.js';
import { getStripe, toStripeAmount } from './stripe.service.js';

type AuditContext = { ipAddress?: string; userAgent?: string };
const paymentSelect = { id: true, status: true, amount: true, provider: true, transactionId: true, createdAt: true, paidAt: true } as const;

export const initiatePayment = async (customerId: string, bookingId: string, context: AuditContext) => {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId }, select: { id: true, status: true, totalAmount: true, customer: { select: { email: true, name: true } }, service: { select: { title: true } }, payment: { select: paymentSelect } } });
  if (!booking) throw new AppError(404, 'Booking not found');
  if (booking.status !== BookingStatus.ACCEPTED) throw new AppError(409, 'Only accepted bookings can be paid');
  if (booking.payment?.status === PaymentStatus.PAID) throw new AppError(409, 'Booking is already paid');
  const stripe = getStripe();
  const payment = booking.payment ?? await prisma.payment.create({ data: { bookingId, userId: customerId, amount: booking.totalAmount, provider: PaymentProvider.STRIPE, status: PaymentStatus.UNPAID }, select: paymentSelect });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: booking.customer.email,
    line_items: [{ price_data: { currency: config.stripe.currency, product_data: { name: booking.service.title }, unit_amount: toStripeAmount(booking.totalAmount) }, quantity: 1 }],
    metadata: { bookingId, paymentId: payment.id, customerId },
    success_url: `${config.stripe.appBaseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.stripe.appBaseUrl}/payments/cancel`,
  });
  if (!session.url) throw new AppError(502, 'Stripe did not return a checkout URL');
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PENDING, transactionId: session.id, gatewayResponse: { checkoutSessionId: session.id, currency: config.stripe.currency } } });
    await createAuditLog(tx, { userId: customerId, action: 'PAYMENT_INITIATED', entityType: 'Payment', entityId: payment.id, newData: { bookingId, amount: payment.amount.toString(), currency: config.stripe.currency }, ...context });
  });
  return { paymentUrl: session.url, sessionId: session.id };
};

export const getPaymentStatus = async (customerId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId }, select: { id: true, status: true, payment: { select: paymentSelect } } });
  if (!booking) throw new AppError(404, 'Booking not found');
  return { bookingId: booking.id, bookingStatus: booking.status, currency: config.stripe.currency, payment: booking.payment ?? { status: PaymentStatus.UNPAID } };
};

export const finalizeCheckout = async (session: { id: string; payment_status: string; amount_total: number | null; currency: string | null; metadata: Record<string, string> | null }) => {
  if (session.payment_status !== 'paid') return;
  const paymentId = session.metadata?.paymentId; const bookingId = session.metadata?.bookingId;
  if (!paymentId || !bookingId) throw new AppError(400, 'Stripe checkout metadata is invalid');
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, bookingId, transactionId: session.id }, include: { booking: true } });
    if (!payment) throw new AppError(404, 'Payment not found');
    if (payment.status === PaymentStatus.PAID) return;
    if (payment.booking.status !== BookingStatus.ACCEPTED && payment.booking.status !== BookingStatus.CONFIRMED) throw new AppError(409, 'Booking cannot be confirmed');
    if (session.currency?.toLowerCase() !== config.stripe.currency || session.amount_total !== toStripeAmount(payment.amount)) throw new AppError(400, 'Stripe amount or currency does not match payment');
    const paidAt = new Date();
    await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PAID, paidAt, gatewayResponse: { checkoutSessionId: session.id, paymentStatus: session.payment_status } } });
    if (payment.booking.status === BookingStatus.ACCEPTED) await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED } });
    await createAuditLog(tx, { userId: payment.userId, action: 'PAYMENT_SUCCESS', entityType: 'Payment', entityId: payment.id, oldData: { status: payment.status }, newData: { status: PaymentStatus.PAID, bookingId }, });
  });
};

export const markPaymentFailed = async (paymentIntentId: string) => {
  const payment = await prisma.payment.findFirst({ where: { transactionId: paymentIntentId, status: PaymentStatus.PENDING }, select: { id: true, userId: true } });
  if (!payment) return;
  await prisma.$transaction(async (tx) => { await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } }); await createAuditLog(tx, { userId: payment.userId, action: 'PAYMENT_FAILED', entityType: 'Payment', entityId: payment.id, newData: { status: PaymentStatus.FAILED } }); });
};
