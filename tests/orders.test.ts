import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Isolated tests never connect to the configured application database or Stripe.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/servexa_unit';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'isolated-order-test-secret';
process.env.PLATFORM_FEE_PERCENT = '10';
process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_not_a_real_key';
const { default: prisma } = await import('../src/lib/prisma.js');
const { Prisma } = await import('../src/generated/prisma/client.js');
const orders = await import('../src/app/modules/Booking/booking.service.js');
const payments = await import('../src/app/modules/Payment/payment.service.js');
const { getStripe } = await import('../src/app/modules/Payment/stripe.service.js');
const { createBookingValidationSchema } = await import('../src/app/modules/Booking/booking.validation.js');
const { default: auth } = await import('../src/app/middlewares/auth.js');
const { generateAccessToken } = await import('../src/helpers/jwtHelper.js');
const restorers: (() => void)[] = [];
function replace(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  restorers.push(() => { target[key] = original; });
}
let booking: any;
let createCalls: any[];
let service: any;
let tx: any;
beforeEach(() => {
  createCalls = [];
  service = { id: 'service', providerId: 'provider', price: new Prisma.Decimal('70'), provider: { userId: 'provider-user' } };
  booking = { id: 'order', status: 'PENDING', service: { id: 'service', title: 'Website design' }, totalAmount: new Prisma.Decimal('77'), customer: { email: 'test@example.test' }, payment: null };
  tx = {
    service: { findFirst: async ({ where }: any) => {
      assert.equal(where.status, 'ACTIVE');
      assert.equal(where.deletedAt, null);
      assert.equal(where.category.deletedAt, null);
      assert.equal(where.provider.status, 'APPROVED');
      assert.equal(where.provider.user.status, 'ACTIVE');
      return service;
    } },
    booking: {
      create: async ({ data, select }: any) => {
        assert.equal('slot' in select, false);
        assert.equal('slotId' in data, false);
        createCalls.push(data);
        return { ...booking, ...data, id: `order-${createCalls.length}` };
      },
      update: async ({ data }: any) => (booking = { ...booking, ...data }),
    },
    auditLog: { create: async () => ({}) },
  };
  replace(prisma, '$transaction', async (fn: any) => fn(tx));
  replace(prisma.user, 'findFirst', async ({ where }: any) => { assert.equal(where.role, 'CUSTOMER'); return { id: 'customer' }; });
  replace(prisma.providerProfile, 'findFirst', async () => ({ id: 'provider' }));
  replace(prisma.booking, 'findFirst', async () => booking);
  replace(prisma.availabilitySlot, 'findFirst', () => { throw new Error('Orders must not query availability'); });
});
afterEach(() => { while (restorers.length) restorers.pop()!(); mock.restoreAll(); });

test('creation body accepts service and notes, rejects slot IDs and client totals', () => {
  assert.deepEqual(createBookingValidationSchema.parse({ serviceId: ' service ', notes: ' Brief ' }), { serviceId: 'service', notes: 'Brief' });
  for (const extra of [{ slotId: 'legacy' }, { totalAmount: '1' }, { quantity: 2 }]) assert.equal(createBookingValidationSchema.safeParse({ serviceId: 'service', ...extra }).success, false);
});
test('creates independent PENDING service orders with server price snapshots and no slots', async () => {
  const a = await orders.createBooking('customer', { serviceId: 'service' }, {});
  const b = await orders.createBooking('other-customer', { serviceId: 'service', notes: 'Brief' }, {});
  assert.notEqual(a.id, b.id);
  assert.equal(a.status, 'PENDING');
  assert.equal(a.totalAmount.toString(), '77');
  assert.equal(createCalls[0].providerId, 'provider');
  assert.equal(createCalls[0].platformFee.toString(), '7');
});
for (const reason of ['invalid', 'inactive', 'deleted', 'unapproved provider']) test(`${reason} service cannot be ordered`, async () => {
  service = null;
  await assert.rejects(orders.createBooking('customer', { serviceId: 'service' }, {}), { statusCode: 404 });
  assert.equal(createCalls.length, 0);
});
test('inactive or noncustomer account cannot create an order', async () => {
  replace(prisma.user, 'findFirst', async ({ where }: any) => { assert.equal(where.role, 'CUSTOMER'); return null; });
  await assert.rejects(orders.createBooking('provider-user', { serviceId: 'service' }, {}), { statusCode: 403 });
});
test('customer cannot order their own service', async () => {
  service.provider.userId = 'customer';
  await assert.rejects(orders.createBooking('customer', { serviceId: 'service' }, {}), { statusCode: 403 });
});
test('authentication rejects an anonymous request and a provider role', async () => {
  const middleware = auth('CUSTOMER');
  let error: any;
  await middleware({ headers: {} } as any, {} as any, e => { error = e; });
  assert.equal(error.statusCode, 401);
  replace(prisma.user, 'findFirst', async () => ({ id: 'provider-user', role: 'PROVIDER' }));
  await middleware({ headers: { authorization: `Bearer ${generateAccessToken({ userId: 'provider-user', role: 'PROVIDER' })}` } } as any, {} as any, e => { error = e; });
  assert.equal(error.statusCode, 403);
});
test('provider accepts and rejects independent pending orders without slots', async () => {
  assert.equal((await orders.acceptBooking('provider-user', 'order', {})).status, 'ACCEPTED');
  booking.status = 'PENDING';
  assert.equal((await orders.rejectBooking('provider-user', 'order', {})).status, 'REJECTED');
});
test('legacy order cancellation preserves records and does not depend on its slot', async () => {
  booking.slotId = 'legacy-slot';
  assert.equal((await orders.cancelBooking('customer', 'order', {})).status, 'CANCELLED');
  assert.equal(booking.slotId, 'legacy-slot');
});
for (const status of ['PENDING', 'REJECTED', 'CANCELLED']) test(`${status} order cannot initiate payment`, async () => {
  booking.status = status;
  await assert.rejects(payments.initiatePayment('customer', 'order', {}), { statusCode: 409 });
});
test('accepted order uses existing Stripe checkout with persisted price', async () => {
  booking.status = 'ACCEPTED';
  const payment = { id: 'payment', amount: new Prisma.Decimal('77'), status: 'UNPAID' };
  replace(prisma.payment, 'create', async () => payment);
  tx.payment = { update: async () => payment };
  mock.method(getStripe().checkout.sessions, 'create', async (body: any) => {
    assert.equal(body.line_items[0].price_data.unit_amount, 7700);
    assert.equal(body.metadata.bookingId, 'order');
    return { id: 'checkout', url: 'https://checkout.stripe.com/test' } as any;
  });
  assert.equal((await payments.initiatePayment('customer', 'order', {})).sessionId, 'checkout');
});
test('existing reconciliation marks payment PAID and order CONFIRMED without any slot', async () => {
  booking.status = 'ACCEPTED';
  let state = 'PENDING';
  tx.payment = {
    findFirst: async () => ({ id: 'payment', userId: 'customer', status: state, amount: new Prisma.Decimal('77'), booking }),
    update: async ({ data }: any) => { state = data.status; },
  };
  const session = { id: 'checkout', payment_status: 'paid', amount_total: 7700, currency: 'usd', metadata: { paymentId: 'payment', bookingId: 'order' } };
  await payments.finalizeCheckout(session);
  await payments.finalizeCheckout(session);
  assert.equal(state, 'PAID');
  assert.equal(booking.status, 'CONFIRMED');
});
