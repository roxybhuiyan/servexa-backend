# Servexa Backend

Servexa is an API-first, on-demand service booking marketplace. Customers book
provider-owned services, providers accept or reject independent orders, and
administrators moderate marketplace data and review reporting/audit activity.

## Stack

- Node.js, TypeScript, and Express
- PostgreSQL/Neon, Prisma 7, `@prisma/adapter-pg`
- Zod validation, JWT authentication, bcryptjs password hashing
- Stripe Checkout and signed Stripe webhooks
- Helmet, CORS, and rate limiting

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`; set only the variables listed there.
3. Validate/generate Prisma Client: `npx prisma validate && npx prisma generate`
4. Check migration state: `npx prisma migrate status`
5. Start development: `npm run dev`

Use `DATABASE_URL` for the application runtime and Prisma CLI configuration;
`DIRECT_URL` is retained for direct tooling such as the seed script. Never
commit `.env` or put connection strings, JWT secrets, or Stripe secrets in
documentation.

### Environment variable names

`NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
`BCRYPT_SALT_ROUNDS`, `PLATFORM_FEE_PERCENT`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `APP_BASE_URL`, and
`CORS_ORIGINS`.

### Browser origins and Render

`CORS_ORIGINS` is a comma-separated allowlist of browser origins, such as
`http://localhost:3000,http://localhost:5173` locally. In Render production,
set it to the exact HTTPS frontend origins; wildcard origins are rejected.
Requests without an `Origin` header (Stripe webhooks, Postman, health checks,
and server-to-server callers) remain supported. The app trusts exactly one
reverse-proxy hop in production so rate limiting uses the real client IP behind
Render; local development does not enable proxy trust.

## Commands

- `npm run dev` — run the TypeScript server with file watching
- `npm run build` — compile to `dist`
- `npm run start` — run the compiled server
- `npm run lint` — run ESLint
- `npx prisma validate` — validate Prisma schema/configuration
- `npx prisma generate` — generate Prisma Client
- `npx prisma migrate status` — inspect migration state
- `npm run prisma:seed` — seed the six base categories

## API and Postman

The health endpoint is `GET /health`. Versioned API routes are under
`/api/v1`; authenticated routes use `Authorization: Bearer <access token>`.

The ready-to-import Postman collection is
[`postman/Servexa.postman_collection.json`](postman/Servexa.postman_collection.json).
Its local placeholder environment is
[`postman/Servexa.local.postman_environment.json`](postman/Servexa.local.postman_environment.json).
Full endpoint, request, workflow, and error documentation is in
[`API_SPEC.md`](API_SPEC.md).

## Core workflow

1. A customer orders an approved provider's active service with `{ serviceId, notes? }`.
   The server creates a PENDING order and snapshots its price; no slot is required.
2. The provider accepts or rejects the independent order. Multiple orders of the
   same service are allowed; no inventory or scheduling is involved.
3. The customer starts Stripe Checkout only after the booking is `ACCEPTED`.
   Amounts are trusted persisted booking snapshots, never client totals.
4. Stripe's signed `checkout.session.completed` webhook marks the payment
   `PAID` and confirms the booking. Browser redirects are informational only.
5. After the provider completes work, the customer may create one 1–5 review
   for that completed booking.

### Local Stripe webhook testing


Configure Stripe test credentials locally, run the API, then forward Stripe
events with:

```bash
stripe listen --forward-to http://localhost:5000/api/v1/payments/stripe/webhook
```

Copy the listener-provided webhook secret into local `.env`; do not place it
in Postman or source control. The webhook, not `/payments/success`, confirms
payment state.

## Deployment target and status

The intended deployment target is **Render + Neon**. Steps 0–10 and final
end-to-end QA are complete, including a real Stripe test-mode Checkout and
signed webhook flow. Before a production deployment, complete the operational
readiness item documented in the security/performance audit: remediate the
current Express/`qs` advisory chain through a tested dependency update.


## Service-order migration and deployment

Migration: `20261008120000_service_orders_optional_legacy_slot`.
It only runs `ALTER TABLE "Booking" ALTER COLUMN "slotId" DROP NOT NULL`.
Existing IDs, booking rows, slot links, unique index, foreign key, payments,
reviews and audit history remain intact. New orders omit slotId (NULL).
The optional relation explicitly retains ON DELETE RESTRICT.

Apply this migration **before** running the updated API. Regenerate Prisma with
`npm run prisma:generate`, then run `npm run typecheck`, `npm test`, and `npm run build`.
Use `npx prisma migrate deploy` only after verifying DATABASE_URL targets the
intended database and obtaining the required deployment authorization. Do not
use db push/reset or modify the historical initial migration.

The inspected configured database is hosted Neon, not local PostgreSQL. Its
read-only compatibility check found 3 bookings, 3 payments, 4 slots, and no
orphan slot links. This migration has deliberately not been applied there.
Schema validation and schema-to-schema SQL diff are offline checks, not evidence
of a completed database migration. Old backend builds that assume required
slots must not be rolled back over new slot-free orders without compatibility work.

The backend test suite uses isolated Prisma/Stripe test doubles and cannot connect
to the application database. Live database and Stripe verification are separate.
