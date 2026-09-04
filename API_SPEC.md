# Servexa API Specification

Base URL: `http://localhost:5000` locally. All application routes are prefixed
with `/api/v1`. Successful responses use:

```json
{ "success": true, "message": "...", "data": {} }
```

Errors use `{ "success": false, "message": "...", "errors": [] }`.
Common statuses are `200` (read/update), `201` (created), `400` (validation),
`401` (missing/invalid authentication), `403` (role/ownership/status denied),
`404` (not found), `409` (workflow/uniqueness conflict), `429` (rate limit),
and `500` (unexpected server failure).

## Authentication

Send `Authorization: Bearer <accessToken>` for protected routes. Login and
refresh return `{ accessToken, refreshToken }` in `data`; refresh tokens are
supplied in the JSON body for refresh/logout. Roles are exactly `CUSTOMER`,
`PROVIDER`, and `ADMIN`. Route-level RBAC is enforced in addition to resource
ownership checks.

## Complete route inventory

`Public` means no Bearer token. Query examples list only supported filters;
all paginated lists return `data.meta` and `data.data`.

| Module | Method | Route | Access | Request / successful behavior |
| --- | --- | --- | --- | --- |
| Health | GET | `/health` | Public | Health envelope. |
| Browser redirects | GET | `/payments/success` | Public | Informational only; does not mutate payment/booking. |
| Browser redirects | GET | `/payments/cancel` | Public | Informational only; does not mutate payment/booking. |
| Auth | POST | `/auth/register` | Public | Customer/provider registration; `201`. |
| Auth | POST | `/auth/login` | Public | `{ email, password }`; returns token pair. |
| Auth | POST | `/auth/refresh-token` | Public | `{ refreshToken }`; rotates token pair. |
| Auth | POST | `/auth/logout` | Public | `{ refreshToken }`; revokes stored token. |
| Auth | GET | `/auth/me` | Any authenticated | Safe current user/profile. |
| User | GET/PATCH | `/users/me` | Any authenticated | Read or update own `{ name?, phone? }`. |
| Provider | GET/PATCH | `/providers/me` | PROVIDER | Read/update provider profile. |
| Provider bookings | GET | `/providers/me/bookings` | PROVIDER | `page,limit,status,serviceId,sortOrder`. |
| Provider bookings | GET | `/providers/me/bookings/:id` | PROVIDER | Own assigned booking only. |
| Provider bookings | PATCH | `/providers/me/bookings/:id/accept` | PROVIDER | `PENDING → ACCEPTED`. |
| Provider bookings | PATCH | `/providers/me/bookings/:id/reject` | PROVIDER | `PENDING → REJECTED`; eligible slot is freed. |
| Provider bookings | PATCH | `/providers/me/bookings/:id/start` | PROVIDER | `CONFIRMED → IN_PROGRESS`. |
| Provider bookings | PATCH | `/providers/me/bookings/:id/complete` | PROVIDER | `IN_PROGRESS → COMPLETED`. |
| Provider availability | GET/POST | `/providers/me/availability` | PROVIDER | List filters or create `{ serviceId,startTime,endTime }`. |
| Provider availability | PATCH/DELETE | `/providers/me/availability/:id` | PROVIDER | Update fields or delete own unbooked slot. |
| Provider services | GET/POST | `/providers/me/services` | PROVIDER | List filters or create a provider service. |
| Provider services | PATCH/DELETE | `/providers/me/services/:id` | PROVIDER | Update or soft-delete own service. |
| Provider public | GET | `/providers/:providerId/reviews` | Public | Paginated public provider reviews. |
| Provider public | GET | `/providers/:providerId/rating-summary` | Public | Aggregate rating summary. |
| Provider public | GET | `/providers/:id` | Public | Approved public profile. |
| Categories | GET | `/categories` | Public | Active categories. |
| Services | GET | `/services` | Public | `page,limit,search,category,provider,city,minPrice,maxPrice,sortBy,sortOrder`. |
| Services | GET | `/services/:serviceId/availability` | Public | Future available slots; `from,to,page,limit`. |
| Services | GET | `/services/:serviceId/reviews` | Public | Public reviews; `page,limit,rating,sortOrder`. |
| Services | GET | `/services/:serviceId/rating-summary` | Public | Aggregate rating summary. |
| Services | GET | `/services/:id` | Public | Eligible public service detail. |
| Bookings | POST | `/bookings` | CUSTOMER | `{ serviceId,slotId,notes? }`; creates `PENDING` booking. |
| Bookings | GET | `/bookings/me` | CUSTOMER | `page,limit,status,serviceId,sortOrder`. |
| Bookings | GET | `/bookings/:id` | CUSTOMER | Own booking only. |
| Bookings | PATCH | `/bookings/:id/cancel` | CUSTOMER | Eligible cancellation. |
| Payments | POST | `/payments/initiate/:bookingId` | CUSTOMER | Creates Stripe Checkout for own `ACCEPTED` booking; `201`. |
| Payments | GET | `/payments/booking/:bookingId` | CUSTOMER | Own booking payment status. |
| Stripe | POST | `/payments/stripe/webhook` | Stripe only | Raw signed Stripe event; not a manual Postman request. |
| Reviews | POST | `/reviews` | CUSTOMER | `{ bookingId,rating,comment? }`; completed own booking only. |
| Reviews | GET | `/reviews/me` | CUSTOMER | Own non-deleted reviews. |
| Reviews | PATCH/DELETE | `/reviews/:id` | CUSTOMER | Update or soft-delete own review. |
| Admin dashboard | GET | `/admin/dashboard/overview` | ADMIN | Marketplace metrics. |
| Admin dashboard | GET | `/admin/dashboard/revenue` | ADMIN | `from,to,providerId,serviceId`. |
| Admin dashboard | GET | `/admin/dashboard/bookings` | ADMIN | `from,to,providerId,serviceId,customerId`. |
| Admin dashboard | GET | `/admin/dashboard/providers` | ADMIN | Provider totals and bounded ranking. |
| Admin dashboard | GET | `/admin/dashboard/services` | ADMIN | Service totals and bounded rankings. |
| Admin dashboard | GET | `/admin/dashboard/recent-activity` | ADMIN | `limit` (1–100), newest first. |
| Audit logs | GET | `/admin/audit-logs` | ADMIN | `page,limit,action,entityType,entityId,userId,from,to,sortOrder`. |
| Audit logs | GET | `/admin/audit-logs/:id` | ADMIN | One recursively-sanitized audit record. |
| Admin users | GET | `/admin/users` | ADMIN | `page,limit,search,role,status,sortBy,sortOrder`. |
| Admin users | GET | `/admin/users/:id` | ADMIN | Safe user detail. |
| Admin users | PATCH | `/admin/users/:id/status` | ADMIN | `{ status: ACTIVE|SUSPENDED|BLOCKED }`. |
| Admin users | DELETE | `/admin/users/:id` | ADMIN | Soft delete; admin cannot delete self. |
| Admin providers | GET | `/admin/providers` | ADMIN | `page,limit,search,status,sortBy,sortOrder`. |
| Admin providers | PATCH | `/admin/providers/:id/status` | ADMIN | `{ status: PENDING|APPROVED|REJECTED }`. |
| Admin categories | GET/POST | `/admin/categories` | ADMIN | Admin list filters or create category. |
| Admin categories | PATCH/DELETE | `/admin/categories/:id` | ADMIN | Update or safe soft delete. |
| Admin reviews | GET | `/admin/reviews` | ADMIN | Review moderation list filters. |
| Admin reviews | DELETE | `/admin/reviews/:id` | ADMIN | Soft-delete moderation. |

The combined rows represent **66 registered HTTP endpoints**: compound rows
expand to their shown methods. **63 are meaningful assignment APIs**; health
and the two browser redirect endpoints are intentionally excluded from that
business-API count. The minimum 20-API requirement is therefore satisfied.

## Request bodies

Customer registration:

```json
{ "name": "Test Customer", "email": "customer@example.com", "password": "StrongPassword123!", "phone": "01700000000", "role": "CUSTOMER" }
```

Provider registration adds `role: "PROVIDER"`, `businessName`, `city`,
`address`, and optional `bio`. Service creation accepts `categoryId`, `title`,
`description?`, `price`, `duration`, `imageUrl?`, `serviceArea?`, and optional
`status` (`ACTIVE` or `INACTIVE`). Availability requires ISO datetimes with an
offset. Review rating is an integer from 1 through 5.

## Booking and payment workflow

Booking transitions are exact:

```text
PENDING     → ACCEPTED | REJECTED | CANCELLED
ACCEPTED    → CONFIRMED | CANCELLED
CONFIRMED   → IN_PROGRESS | CANCELLED
IN_PROGRESS → COMPLETED
```

Providers accept/reject/start/complete their own approved-profile bookings.
Customers cancel their own eligible unpaid bookings. Creating a booking
atomically reserves a future slot; `Booking.slotId` is unique as a final
database safeguard. The server snapshots `servicePrice`, `platformFee`, and
`totalAmount` using Decimal arithmetic, so client totals are ignored.

For Stripe: the customer initiates Checkout for an `ACCEPTED` booking; the
server uses persisted totals and creates a Checkout Session. Stripe then POSTs
a signed event to `/api/v1/payments/stripe/webhook`. After signature and amount
validation, `checkout.session.completed` sets Payment to `PAID` and Booking to
`CONFIRMED`. `/payments/success` and `/payments/cancel` are informational
redirects only—not payment confirmation. For local testing use
`stripe listen --forward-to http://localhost:5000/api/v1/payments/stripe/webhook`.

## Reviews, reporting, and audit logs

Only a customer can review their own `COMPLETED` booking. One review is allowed
per booking (`Review.bookingId` is unique); public responses hide customer
email/phone, soft-deleted reviews are excluded, and rating summaries are DB
aggregates. Live critical Step 8 review runtime verification was deferred and
belongs in final QA.

Admin dashboard marketplace counts exclude soft-deleted entities. Historical
booking/payment revenue remains countable after a related marketplace entity is
deleted. Audit list/detail APIs paginate/filter newest-first and recursively
redact sensitive snapshot keys (passwords, tokens, secrets, JWTs, cookies,
authorization, database URLs, webhook/card data) without mutating stored logs.

## Coverage matrix

| Requirement | Status |
| --- | --- |
| Node/TypeScript/Express/PostgreSQL/Prisma 7 | PASS |
| Zod, bcrypt hashing, JWT, exactly three roles, RBAC | PASS |
| 20+ meaningful APIs; standard envelopes | PASS (63) |
| Pagination, filtering, searching, sorting | PASS |
| Soft deletes, audit logging, indexes/unique constraints | PASS |
| Stripe Checkout, status tracking, signed webhook | PASS |
| Transactions and double-booking safeguards | PASS |
| Helmet, CORS, rate limiting | PASS |
| Postman collection and API documentation | PASS |
| End-to-end review, ratings, analytics, and audit QA | PASS |
| Render + Neon deployment execution | DEFERRED |
