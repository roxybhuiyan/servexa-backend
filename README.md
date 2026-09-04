# Servexa Backend

Servexa is an API-first, on-demand service booking marketplace. Customers book
provider-owned services, providers manage availability and booking work, and
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
`STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, and `APP_BASE_URL`.

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

1. A customer registers/logs in and creates a booking for a future available
   slot on an approved provider's active service.
2. The provider accepts or rejects it. Slots are reserved atomically and
   `Booking.slotId` is unique, preventing double booking.
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
readiness items documented in the security/performance audit: restrict CORS to
known frontend origins, configure proxy trust for Render, and remediate the
current Express/`qs` advisory chain through a tested dependency update.
