> Historical slot-based implementation snapshot. The service-order contract in [API_SPEC.md](API_SPEC.md#service-order-contract-october-2026) supersedes booking/availability workflows below: POST /bookings accepts serviceId and optional notes; slot UI and response fields are removed.

# Servexa Backend to Frontend Integration Specification

এই রিপোর্ট backend-এর বর্তমান source code থেকে frontend implementation contract নির্ধারণ করে। এটি frontend code বা ভবিষ্যৎ feature proposal নয়। Backend-এ customer, provider ও admin workflow আছে; কিন্তু code inspection-এর ভিত্তিতে পুরো system-কে production-ready ঘোষণা করা যায় না। বিশেষ করে cancelled slot reuse, payment retry/failure reconciliation, concurrent workflow updates এবং rating consistency-এর সীমাবদ্ধতা frontend পরিকল্পনায় ধরতে হবে।

**বিশ্লেষণের তারিখ:** ৫ অক্টোবর ২০২৬, Asia/Dhaka। **Scope:** এই repository snapshot; deployed database, live Stripe account বা production server যাচাই করা হয়নি। Secrets, `.env` values ও credentials পড়া/প্রকাশ করা হয়নি। Backend functionality পরিবর্তন করা হয়নি।

**Evidence convention:** সব path এই `servexa-backend/` directory-র relative। `Module/foo.service.ts` সংক্ষিপ্ত reference মানে `src/app/modules/Module/foo.service.ts`; route/controller/validation একই directory-তে। নিচের endpoint entries-তে exact source link আছে। `IMPLEMENTED` মানে registered code আছে, live QA pass নয়। `NOT FOUND` মানে inspected runtime source/schema-তে নেই; `NEEDS VERIFICATION` মানে deployment বা runtime evidence দরকার। Frontend আচরণের প্রস্তাবকে “frontend contract/handling” হিসেবে চিহ্নিত করা হয়েছে।

**Coverage:** 44 handwritten module files, app/server/config, auth middleware, utilities/helpers, Prisma schema ও initial migration, seed, generated enums, README/API_SPEC/DATABASE_SPEC/PROJECT_SPEC/ARCHITECTURE/DEVELOPMENT_RULES এবং Postman inventory cross-check। 66 explicit HTTP endpoints: 62 browser-facing versioned endpoints, 1 Stripe webhook, 1 health এবং 2 informational redirects। Express-generated HEAD/OPTIONS এই count-এ নেই।

## 1. Project overview

| বিষয় | বাস্তব implementation এবং evidence |
|---|---|
| Purpose/domain | Provider-owned on-demand service marketplace; category → service → availability slot → booking → payment → review. `prisma/schema.prisma`, `Booking/booking.service.ts::createBooking` |
| Architecture | Express route → controller (Zod parse) → service (business/Prisma) → PostgreSQL. `src/app.ts`, `src/app/routes/index.ts`, module files |
| Language/runtime | TypeScript strict, Node >=20, ESM/NodeNext; `package.json`, `tsconfig.json` |
| Framework | Express declared ^4.21.2; installed 4.22.2 at inspection. Zod declared ^3.24.1; installed 3.25.76. Installed versions do not establish deployed versions |
| DB/ORM | PostgreSQL, Prisma 7.10.0 installed, `@prisma/adapter-pg` + `pg.Pool`; pool max 5, transaction maxWait 15s / timeout 30s. `src/lib/prisma.ts`; Neon is documented target, deployed DB UNKNOWN |
| Authentication | bcryptjs password hashes; JWT access + rotating DB-backed SHA-256-hashed refresh tokens. `Auth/auth.service.ts`, `src/helpers/jwtHelper.ts`, `src/utils/*` |
| Authorization | Exactly CUSTOMER, PROVIDER, ADMIN; database ACTIVE/non-deleted user checked on every protected request; ownership and provider approval checks in services. `src/app/middlewares/auth.ts` |
| Upload | NOT FOUND. Only nullable `Service.imageUrl` text field |
| Payment | Stripe hosted Checkout + signed raw webhook. SSLCOMMERZ only enum, no gateway implementation. `Payment/*` |
| Notification/email/SMS | NOT FOUND. Stripe receives customer_email for Checkout; backend does not implement email sending |
| Realtime | NOT FOUND; no WebSocket/SSE/Socket.IO server or client event protocol |
| External services/APIs | Stripe API, configured PostgreSQL connection. No maps, geocoding or other application external API found |
| Background jobs/queues/cache | NOT FOUND; no booking expiry job, token cleanup scheduler, Redis or cache layer. Prisma/Stripe singleton instances are connection/client reuse, not business-data caching |
| Search | Prisma case-insensitive contains/equality + filters/orderBy, offset pagination; no search engine. `Service/service.service.ts`, `Admin/admin.service.ts`, `Review/review.service.ts` |
| Deployment | Render + Neon documented target. Live origin, credentials, migration state and readiness UNKNOWN |

## 2. Complete backend structure

| Path | Purpose | Frontend relevance |
|---|---|---|
| `src/app.ts` | Helmet/CORS/raw webhook/JSON/rate limit/root routes/global errors | Envelopes, CORS, 429, webhook exception |
| `src/server.ts` | Listen/shutdown | Default port comes from config |
| `src/config/index.ts` | Environment/defaults | Origin, currency, Checkout return URL, expiry |
| `src/app/routes/index.ts` | Mount 9 versioned routers | Exact `/api/v1` prefixes |
| `src/app/middlewares/auth.ts` | Bearer validation and DB RBAC | 401 vs 403, current DB role |
| `src/app/modules/Auth/` | route/controller/service/validation/interface | Registration, login, refresh, logout, me |
| `src/app/modules/User/` | route/controller/service/validation | Own user profile |
| `src/app/modules/Provider/` | profile logic; router mounts services, slots, jobs, reviews | Provider self/public profile and nested routes |
| `src/app/modules/Category/` | public route; CRUD invoked by admin controller | Public options/admin catalog |
| `src/app/modules/Service/` | public discovery + provider CRUD | Listings/forms/details |
| `src/app/modules/Availability/` | slot CRUD/public nested router | Scheduling |
| `src/app/modules/Booking/` | customer/provider job workflow | Ownership, amounts, status |
| `src/app/modules/Payment/` | route/controller/service/Stripe helper; no separate validation file | Checkout/status/webhook |
| `src/app/modules/Review/` | customer CRUD/public summaries/admin moderation | Reviews/ratings |
| `src/app/modules/Admin/` | admin.* + dashboard.controller/service/validation | Users/providers/categories/reviews/analytics/audit |
| `src/shared/sendResponse.ts`, `src/app/errors/AppError.ts` | success envelope/custom error | Client adapter |
| `src/helpers/jwtHelper.ts`, `src/utils/password.ts`, `src/utils/tokenHash.ts` | auth implementation | Token semantics; private internals stay server-side |
| `src/helpers/auditLog.ts` | transaction-linked audit inserts | Admin audit/recent activity |
| `src/lib/prisma.ts`, `prisma.config.ts` | DB runtime/CLI | Operational dependency, never browser code |
| `prisma/schema.prisma`, `prisma/migrations/20260902165318_init/migration.sql` | models/enums/unique/FK constraints | Data semantics and edge cases |
| `prisma/seed.ts` | upsert six categories only | No guaranteed service/provider/admin account |
| `src/generated/prisma/` | generated models/enums/Prisma types | DB types are not API response DTOs |
| `src/types/express.d.ts` | request-user typing | Server-only identity |
| `postman/*.json`, `API_SPEC.md`, `DATABASE_SPEC.md`, `README.md`, other specs | documentation/examples | Cross-check against source, not authoritative over it |
| `tests/.gitkeep` | empty test directory | No committed automated integration suite found |
| `../stripe-verify.ts` | standalone verification script outside backend; directly creates/deletes DB fixtures and calls Checkout/status | Inspected with string literals redacted; not mounted API, not executed; no saved test result |

Separate DTO classes, worker module, notification/upload module, order model, permission-grant table: **NOT FOUND**. DTO-like inputs are Zod schemas, `Auth/auth.interface.ts` and inline service types. `src/app/builder` has no query builder implementation.

## 3. Complete API inventory

### 3.1 Shared HTTP contract

Origin default is `http://localhost:5000`; versioned base is `http://localhost:5000/api/v1`. Deployment origin UNKNOWN. Endpoint entries show full path including prefix. IDs are opaque strings, not UUIDs; generated IDs use cuid. Path helpers only check `typeof value === 'string'`, not cuid format; non-string parameter guard yields400 `Invalid resource id` (provider profile helper: `Invalid provider id`). The declared availabilityId/bookingId Zod schemas are not used by route handlers. Unrecognized IDs generally return 404, while list/aggregate filters may return empty data/zeros.

For JSON bodies send `Content-Type: application/json`; protected endpoints require `Authorization: Bearer <accessToken>` with exact `Bearer ` prefix. No cookie/CSRF header contract. For GET/no-body operations no request body is needed. Unknown query keys in Zod object schemas are stripped. Strict mutation bodies reject unknown keys; auth bodies are non-strict and strip them. Bodyless booking/payment actions do not parse/reject extra body keys; those keys have no implemented effect.

Success envelope `S<T>` is `{success:true,message:string,data:T}`. Lists `Page<T>` are `{meta:{page:number,limit:number,total:number,totalPages:number},data:T[]}` **inside** `S.data`. Therefore read `response.data.data` for rows and `response.data.meta` for metadata when `response` means the parsed JSON object. `totalPages = ceil(total/limit)` and is 0 on no results. Deletion returns HTTP 200 with `data:null`, not 204. Only webhook success uses `{received:true}` without S.

Common errors apply to **each endpoint below**: CORS denial 403 `Origin is not allowed by CORS policy`; uncaught failures 500 `Internal server error`. After the webhook route, global rate limiting yields 429 (text response, not standard JSON). Zod-parsed input may yield 400 `Validation failed`, `errors:[{path:string,message:string}]`. Protected endpoints additionally yield 401 `Authentication is required` / `Invalid token` / `Invalid or expired token`, and role-restricted endpoints 403 `You do not have permission to access this resource`. JWT secret misconfiguration can yield an explicit 500 configuration message. Endpoint entries add business errors to these shared errors. No 422 handler is implemented.

### 3.2 Response shape dictionary

These are exact selected API shapes, not whole DB models. All listed properties are returned unless a union explicitly says otherwise. `?` in database/request sections means optional; nullable response values are marked `|null`. IDs/text = string; dates = JSON ISO string. Prisma Decimal outputs are decimal **strings** (do not assume fixed two digits); analytics `money()` explicitly returns two-decimal strings. Integers/counts/rates = number. `rating` on provider profile = Decimal string, aggregate `averageRating` = number. Evidence: named selects in each service and `prisma/schema.prisma`.

```ts
type ID = string;
type DateString = string;
type DecimalString = string;
type UserRole = 'CUSTOMER'|'PROVIDER'|'ADMIN';
type UserStatus = 'ACTIVE'|'SUSPENDED'|'BLOCKED';
type ProviderStatus = 'PENDING'|'APPROVED'|'REJECTED';
type ServiceStatus = 'ACTIVE'|'INACTIVE';
type BookingStatus = 'PENDING'|'ACCEPTED'|'CONFIRMED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'|'REJECTED';
type PaymentStatus = 'UNPAID'|'PENDING'|'PAID'|'FAILED'|'CANCELLED'|'REFUNDED';
type PaymentProvider = 'SSLCOMMERZ'|'STRIPE';
type TokenPair = {accessToken:string; refreshToken:string};
type UserCore = {id:ID; name:string; email:string; phone:string; role:UserRole;
  status:UserStatus; createdAt:DateString; updatedAt:DateString};
type AuthUser = UserCore & {providerProfile:{id:ID;businessName:string;status:ProviderStatus}|null};
type ProfileFields = {id:ID;businessName:string;bio:string|null;phone:string;city:string;
  address:string;status:ProviderStatus;rating:DecimalString;totalReviews:number;
  createdAt:DateString;updatedAt:DateString};
type UserProfile = UserCore & {providerProfile:ProfileFields|null};
type ProviderUser = {id:ID;name:string;email:string;phone:string;role:UserRole;status:UserStatus};
type ProviderSelf = ProfileFields & {user:ProviderUser};
type ProviderPublic = {id:ID;businessName:string;bio:string|null;city:string;address:string;
  rating:DecimalString;totalReviews:number;createdAt:DateString;
  user:{id:ID;name:string};_count:{services:number}};
type AdminUser = UserCore & {providerProfile:{id:ID;businessName:string;status:ProviderStatus;
  city:string;rating:DecimalString;totalReviews:number}|null};
type AdminProvider = {id:ID;businessName:string;city:string;status:ProviderStatus;
  rating:DecimalString;totalReviews:number;createdAt:DateString;updatedAt:DateString;user:ProviderUser};
type Category = {id:ID;name:string;slug:string;description:string|null;createdAt:DateString;updatedAt:DateString};
type CategoryRef = {id:ID;name:string;slug:string};
type ServiceFields = {id:ID;title:string;slug:string;description:string|null;price:DecimalString;
  duration:number;imageUrl:string|null;serviceArea:string|null;createdAt:DateString;category:CategoryRef};
type PublicService = ServiceFields & {provider:{id:ID;businessName:string;city:string;
  rating:DecimalString;totalReviews:number;user:{id:ID;name:string}}};
type OwnService = ServiceFields & {categoryId:ID;status:ServiceStatus;updatedAt:DateString};
type PublicSlot = {id:ID;serviceId:ID;startTime:DateString;endTime:DateString;createdAt:DateString};
type OwnSlot = PublicSlot & {providerId:ID;isBooked:boolean;updatedAt:DateString;
  service:{id:ID;title:string;slug:string;duration:number;status:ServiceStatus}};
type CustomerBooking = {id:ID;status:BookingStatus;servicePrice:DecimalString;platformFee:DecimalString;
  totalAmount:DecimalString;notes:string|null;createdAt:DateString;updatedAt:DateString;
  cancelledAt:DateString|null;completedAt:DateString|null;
  service:{id:ID;title:string;slug:string;duration:number;imageUrl:string|null};
  provider:{id:ID;businessName:string;city:string;phone:string};
  slot:{id:ID;startTime:DateString;endTime:DateString;isBooked:boolean};
  payment:{status:PaymentStatus;amount:DecimalString;paidAt:DateString|null}|null};
type ProviderBooking = CustomerBooking & {customer:{id:ID;name:string;phone:string}};
type Payment = {id:ID;status:PaymentStatus;amount:DecimalString;provider:PaymentProvider;
  transactionId:string|null;createdAt:DateString;paidAt:DateString|null};
type PaymentState = {bookingId:ID;bookingStatus:BookingStatus;currency:string;
  payment:Payment|{status:'UNPAID'}};
type Checkout = {paymentUrl:string;sessionId:string};
type PublicReview = {id:ID;rating:number;comment:string|null;createdAt:DateString;customer:{id:ID;name:string}};
type OwnReview = PublicReview & {service:{id:ID;title:string};bookingId:ID;updatedAt:DateString};
type AdminReview = OwnReview & {customerId:ID;serviceId:ID;deletedAt:DateString|null;booking:{providerId:ID}};
type RatingSummary = {averageRating:number;reviewCount:number};
type Activity = {id:ID;action:string;entityType:string;entityId:ID;createdAt:DateString;
  user:{id:ID;name:string;role:UserRole}|null};
type Audit = Activity & {userId:ID|null;oldData:unknown;newData:unknown;ipAddress:string|null;userAgent:string|null};
```

`Audit.oldData/newData` are nullable arbitrary JSON, recursively sanitized: sensitive key values become `[REDACTED]`; not a fixed schema. Payment gatewayResponse, password, refresh-token hashes are not selected by these APIs. Booking DTO has no top-level customerId/providerId/serviceId/slotId and no review relation; derive related IDs from nested objects or review listing. PublicService has no status/updatedAt/providerId/categoryId scalar fields. PublicProvider `_count.services` is unfiltered and includes inactive/deleted services.

Dashboard data (all fields required, counts and percentages numbers):

```ts
type Overview = {
 users:{totalUsers:number;activeUsers:number;suspendedUsers:number;blockedUsers:number;totalCustomers:number;totalProviders:number};
 providers:{totalProviders:number;pendingProviders:number;approvedProviders:number;rejectedProviders:number};
 services:{totalServices:number;activeServices:number;inactiveServices:number};
 bookings:{totalBookings:number;pendingBookings:number;acceptedBookings:number;confirmedBookings:number;
   inProgressBookings:number;completedBookings:number;cancelledBookings:number;rejectedBookings:number};
 payments:{totalPayments:number;unpaidPayments:number;paidPayments:number;pendingPayments:number;
   failedPayments:number;cancelledPayments:number;refundedPayments:number};
 reviews:{totalReviews:number;averageRating:number};
};
type Revenue = {grossRevenue:DecimalString;platformRevenue:DecimalString;providerRevenue:DecimalString;
  paidBookingCount:number;averageOrderValue:DecimalString};
type BookingMetrics = {totalBookings:number;counts:{pending:number;accepted:number;confirmed:number;
  inProgress:number;completed:number;cancelled:number;rejected:number};completionRate:number;cancellationRate:number};
type ProviderMetrics = {totalProviders:number;approvedProviders:number;pendingProviders:number;rejectedProviders:number;
  providersWithServices:number;providersWithCompletedBookings:number;topProviders:Array<{
    providerId:ID;businessName:string;completedBookings:number;totalRevenue:DecimalString;averageRating:number;reviewCount:number}>};
type RankedService = {serviceId:ID;title:string;bookingCount:number;completedBookingCount:number;averageRating:number;reviewCount:number};
type ServiceMetrics = {totalServices:number;activeServices:number;inactiveServices:number;servicesWithBookings:number;
  mostBookedServices:RankedService[];highestRatedServices:RankedService[]};
```

### 3.3 Request body dictionary

All text marked “trim” is trimmed before validation/use; no phone country-format check. Required unless explicitly optional. Mutation object bodies are strict except Register/Login/TokenBody. PATCH requires at least one recognized field; empty object fails with `Provide at least one field to update`.

| Contract | Exact fields, defaults and validation |
|---|---|
| Register | `name:string` trim 2–100; `email:string` trim email max255 (service lowercases); `password:string` 8–128, no trim/complexity rule; `phone:string` trim 5–30; `role:CUSTOMER or PROVIDER` explicitly required (DB default does not make body optional). PROVIDER additionally `businessName:string` trim2–150, `city:string` trim2–100, `address:string` trim5–500, optional `bio:string` trim max2000 (not null). No ADMIN registration |
| Login | `email:string` trim email max255; `password:string` 8–128 |
| TokenBody | `refreshToken:string` min1, no trimming; used by refresh/logout |
| PatchUser | optional `name` trim2–100, `phone` trim5–30; no email/password/role changes |
| PatchProvider | optional `businessName` trim2–150, `bio` trim max2000 or null, `phone` trim5–30, `city` trim2–100, `address` trim5–500 |
| CreateCategory | `name:string` trim2–100; optional `slug:string` trim2–160 matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; optional `description:string or null` trim max1000. Omitted slug generated from name |
| PatchCategory | Same fields all optional; changed name regenerates slug unless supplied |
| CreateService | `categoryId:string` trim min1; `title:string` trim2–150; `price` positive decimal string (`^\d+(?:\.\d{1,2})?$`) OR finite positive number, transformed to string; `duration` coerced integer >0 <=1440; optional `description:string or null` trim max5000, `imageUrl:string or null` trim max2048, `serviceArea:string or null` trim max250, `status:ACTIVE or INACTIVE` default ACTIVE in service. imageUrl is not URL-validated. Numeric price branch does not enforce 2 decimal places or DB precision max |
| PatchService | Same fields all optional; no client slug/providerId; no explicit status default on patch |
| CreateSlot | `serviceId:string` trim min1, `startTime:string`, `endTime:string`: ISO 8601 datetime with offset (`Z` or explicit offset); end > start, start > now, no overlapping provider slot |
| PatchSlot | Same fields all optional, merged with stored values before time checks |
| CreateBooking | `serviceId:string`, `slotId:string` both trim min1; optional `notes:string` trim max2000, not null. No amount/address/payment/status keys |
| CreateReview | `bookingId:string` trim min1; `rating:number` integer1–5 (body string not coerced); optional `comment:string` trim max2000, not null |
| PatchReview | optional `rating:number` integer1–5; optional `comment:string or null` trim max2000 |
| UserStatusBody | `status:ACTIVE or SUSPENDED or BLOCKED` |
| ProviderStatusBody | `status:PENDING or APPROVED or REJECTED` |

Evidence: `Auth/auth.validation.ts`, `User/user.validation.ts`, `Provider/provider.validation.ts`, `Category/category.validation.ts`, `Service/service.validation.ts`, `Availability/availability.validation.ts`, `Booking/booking.validation.ts`, `Review/review.validation.ts`, `Admin/admin.validation.ts`. Null accepted only where stated; optional does not mean nullable. duration unit is not enforced/labelled by validation; 1440 suggests minutes but unit requires confirmation (Postman/docs may use that convention). No slot-length-vs-duration check.

### 3.4 Query dictionary

For every paginated query: `page` coerced integer >=1 default1; `limit` coerced integer1–100; default10 unless stated20. `sortOrder` enum asc/desc. Omitted optional filters have no effect. Date boundaries inclusive for listing filters; request offset `+` must be URL-encoded. No arbitrary sort keys.

| Name | Exact supported query keys and behavior |
|---|---|
| QServices | page/limit10; search trim1–100 → title/description contains insensitive; category trim1–200 → ID OR slug; provider trim1–200 → profile ID; city trim1–100 → provider city equality insensitive; minPrice/maxPrice same positive price validator, inclusive, min<=max else400; sortBy createdAt/price/title defaultcreatedAt, sortOrder defaultdesc |
| QOwnServices | page/limit10; search trim1–100 title/description contains; status ServiceStatus; sortBy createdAt/price/title defaultcreatedAt; sortOrder desc |
| QPublicSlots | page/limit20; optional from/to offset ISO strings; startTime >= from (default now), <=to; to<from fails400; fixed startTime asc; explicit past from is accepted |
| QOwnSlots | page/limit20; optional serviceId trim min1, from/to offset ISO strings, isBooked exactly query string true/false converted boolean; sortOrder defaultasc on startTime. No default future restriction |
| QBookings | page/limit10; optional status BookingStatus, serviceId trim min1; sortOrder desc on createdAt. No date/customer/provider/search filters |
| QReviews | page/limit10; optional rating coerced integer1–5; sortOrder desc on createdAt |
| QAdminReviews | QReviews + customerId/providerId/serviceId strings trim min1; search trim1–100 comment contains insensitive. Includes soft-deleted reviews; no deleted filter |
| QUsers | page/limit10; search trim1–100 name/email contains insensitive; role UserRole; status UserStatus; sortBy createdAt/name/email defaultcreatedAt; sortOrder desc |
| QProviders | page/limit10; search trim1–100 businessName/city/user.name/user.email contains insensitive; status ProviderStatus; sortBy createdAt/businessName/city/rating defaultcreatedAt; sortOrder desc |
| QCategories | page/limit10; search trim1–100 name contains insensitive; fixed name asc |
| QRevenue | optional from/to `z.coerce.date()`; providerId/serviceId trim1–100. from<=to or400. Filters Booking.createdAt, not paidAt |
| QBookingMetrics | QRevenue + customerId trim1–100 |
| QActivity | limit coerced integer1–100 default20; fixed createdAt desc; returns array, no pagination metadata |
| QAudit | page/limit20; optional from/to coerced dates with from<=to; action/entityType/entityId/userId trim1–100 exact match; sortOrder desc on createdAt |

Public category list has no query parser and returns all non-deleted categories by name asc. Dashboard overview/providers/services ignore query filters. Unknown list query keys are stripped, not supported UI functionality. Evidence: corresponding `*.validation.ts` and list functions in services; dashboards use `Admin/dashboard.validation.ts`.

### 3.5 Individual endpoint contracts

Each record below defines a separate registered endpoint. `Body`/`Query` names expand fully using dictionaries above; response names expand using 3.2. “Shared errors” is always included; business errors are explicitly added. “none” means no recognized fields, not a body validation schema. All protected paths also require an active, non-deleted account. Path parameters refer to the resource ID named in the URL; provider IDs are ProviderProfile.id, not User.id.

#### E01 — POST `/api/v1/auth/register`

- **Purpose / access:** Registration; Public.
- **Request:** path none; query `none`; body `Register`. Headers: `Content-Type: application/json`.
- **Success:** HTTP 201; `S<AuthUser>`; message `Registration successful`.
- **Rules / next UI behavior:** Creates user; provider registration atomically creates PENDING profile. No tokens returned. Login next.
- **Errors:** Shared errors (§3.1); 409 An account with this email already exists.
- **Evidence:** [src/app/modules/Auth/auth.route.ts](src/app/modules/Auth/auth.route.ts); [src/app/modules/Auth/auth.controller.ts](src/app/modules/Auth/auth.controller.ts); [src/app/modules/Auth/auth.service.ts](src/app/modules/Auth/auth.service.ts); controller `register` → service `registerUser`.

#### E02 — POST `/api/v1/auth/login`

- **Purpose / access:** Login; Public.
- **Request:** path none; query `none`; body `Login`. Headers: `Content-Type: application/json`.
- **Success:** HTTP 200; `S<TokenPair>`; message `Login successful`.
- **Rules / next UI behavior:** Lowercases email, checks bcrypt and active status, stores refresh-token hash.
- **Errors:** Shared errors (§3.1); 401 Invalid email or password; 403 This account is not active.
- **Evidence:** [src/app/modules/Auth/auth.route.ts](src/app/modules/Auth/auth.route.ts); [src/app/modules/Auth/auth.controller.ts](src/app/modules/Auth/auth.controller.ts); [src/app/modules/Auth/auth.service.ts](src/app/modules/Auth/auth.service.ts); controller `login` → service `loginUser`.

#### E03 — POST `/api/v1/auth/refresh-token`

- **Purpose / access:** Refresh session; Public.
- **Request:** path none; query `none`; body `TokenBody`. Headers: `Content-Type: application/json`.
- **Success:** HTTP 200; `S<TokenPair>`; message `Access token refreshed`.
- **Rules / next UI behavior:** Verifies JWT type, DB hash/expiry/revocation and current user/role; transaction revokes old row and creates new row.
- **Errors:** Shared errors (§3.1); 401 Invalid token / Invalid or expired token / Invalid or expired refresh token.
- **Evidence:** [src/app/modules/Auth/auth.route.ts](src/app/modules/Auth/auth.route.ts); [src/app/modules/Auth/auth.controller.ts](src/app/modules/Auth/auth.controller.ts); [src/app/modules/Auth/auth.service.ts](src/app/modules/Auth/auth.service.ts); controller `refreshToken` → service `refreshAccessToken`.

#### E04 — POST `/api/v1/auth/logout`

- **Purpose / access:** Logout; Public.
- **Request:** path none; query `none`; body `TokenBody`. Headers: `Content-Type: application/json`.
- **Success:** HTTP 200; `S<null>`; message `Logout successful`.
- **Rules / next UI behavior:** Revokes all non-revoked rows matching token hash. Does not verify JWT and succeeds for unmatched nonempty token. Access token is not revoked.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Auth/auth.route.ts](src/app/modules/Auth/auth.route.ts); [src/app/modules/Auth/auth.controller.ts](src/app/modules/Auth/auth.controller.ts); [src/app/modules/Auth/auth.service.ts](src/app/modules/Auth/auth.service.ts); controller `logout` → service `logoutUser`.

#### E05 — GET `/api/v1/auth/me`

- **Purpose / access:** Current identity; Any.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<AuthUser>`; message `Current user retrieved`.
- **Rules / next UI behavior:** Small provider profile projection; not full provider profile.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Auth/auth.route.ts](src/app/modules/Auth/auth.route.ts); [src/app/modules/Auth/auth.controller.ts](src/app/modules/Auth/auth.controller.ts); [src/app/modules/Auth/auth.service.ts](src/app/modules/Auth/auth.service.ts); controller `me` → service `getCurrentUser`.

#### E06 — GET `/api/v1/users/me`

- **Purpose / access:** Own profile; Any.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<UserProfile>`; message `Profile retrieved`.
- **Rules / next UI behavior:** Includes full selected provider profile or null.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/User/user.route.ts](src/app/modules/User/user.route.ts); [src/app/modules/User/user.controller.ts](src/app/modules/User/user.controller.ts); [src/app/modules/User/user.service.ts](src/app/modules/User/user.service.ts); controller `getMe` → service `getMyProfile`.

#### E07 — PATCH `/api/v1/users/me`

- **Purpose / access:** Edit user profile; Any.
- **Request:** path none; query `none`; body `PatchUser`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<UserProfile>`; message `Profile updated`.
- **Rules / next UI behavior:** Updates User name/phone only. ProviderProfile.phone is not synchronized.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/User/user.route.ts](src/app/modules/User/user.route.ts); [src/app/modules/User/user.controller.ts](src/app/modules/User/user.controller.ts); [src/app/modules/User/user.service.ts](src/app/modules/User/user.service.ts); controller `updateMe` → service `updateMyProfile`.

#### E08 — GET `/api/v1/providers/me`

- **Purpose / access:** Provider profile; PROVIDER.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderSelf>`; message `Provider profile retrieved`.
- **Rules / next UI behavior:** No APPROVED prerequisite for self profile.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Provider/provider.controller.ts](src/app/modules/Provider/provider.controller.ts); [src/app/modules/Provider/provider.service.ts](src/app/modules/Provider/provider.service.ts); controller `getMe` → service `getMyProviderProfile`.

#### E09 — PATCH `/api/v1/providers/me`

- **Purpose / access:** Edit provider profile; PROVIDER.
- **Request:** path none; query `none`; body `PatchProvider`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<ProviderSelf>`; message `Provider profile updated`.
- **Rules / next UI behavior:** PENDING/REJECTED profile may edit; status cannot be changed here; audit recorded. User.phone not synchronized.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Provider/provider.controller.ts](src/app/modules/Provider/provider.controller.ts); [src/app/modules/Provider/provider.service.ts](src/app/modules/Provider/provider.service.ts); controller `updateMe` → service `updateMyProviderProfile`.

#### E10 — GET `/api/v1/providers/:id`

- **Purpose / access:** Public provider; Public.
- **Request:** path `id:string`; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<ProviderPublic>`; message `Provider profile retrieved`.
- **Rules / next UI behavior:** Only APPROVED non-deleted profile with active/non-deleted user. Count is all related services.
- **Errors:** Shared errors (§3.1); 404 Provider not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Provider/provider.controller.ts](src/app/modules/Provider/provider.controller.ts); [src/app/modules/Provider/provider.service.ts](src/app/modules/Provider/provider.service.ts); controller `getPublicProfile` → service `getPublicProviderProfile`.

#### E11 — GET `/api/v1/categories`

- **Purpose / access:** Browse categories; Public.
- **Request:** path none; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<Category[]>`; message `Categories retrieved`.
- **Rules / next UI behavior:** All non-deleted categories, no pagination; fixed name asc.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Category/category.route.ts](src/app/modules/Category/category.route.ts); [src/app/modules/Category/category.controller.ts](src/app/modules/Category/category.controller.ts); [src/app/modules/Category/category.service.ts](src/app/modules/Category/category.service.ts); controller `listPublicCategories` → service `getPublicCategories`.

#### E12 — GET `/api/v1/services`

- **Purpose / access:** Discover services; Public.
- **Request:** path none; query `QServices`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<Page<PublicService>>`; message `Services retrieved`.
- **Rules / next UI behavior:** Only ACTIVE non-deleted service, non-deleted category and APPROVED non-deleted provider with active/non-deleted user.
- **Errors:** Shared errors (§3.1); 400 minPrice cannot exceed maxPrice.
- **Evidence:** [src/app/modules/Service/service.route.ts](src/app/modules/Service/service.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `listPublic` → service `listPublicServices`.

#### E13 — GET `/api/v1/services/:id`

- **Purpose / access:** Service details; Public.
- **Request:** path `id:string`; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<PublicService>`; message `Service retrieved`.
- **Rules / next UI behavior:** Same public visibility predicate as listing; lookup by id only, not slug.
- **Errors:** Shared errors (§3.1); 404 Service not found.
- **Evidence:** [src/app/modules/Service/service.route.ts](src/app/modules/Service/service.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `getPublic` → service `getPublicService`.

#### E14 — GET `/api/v1/providers/me/services`

- **Purpose / access:** Own services; PROVIDER.
- **Request:** path none; query `QOwnServices`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<OwnService>>`; message `Services retrieved`.
- **Rules / next UI behavior:** Own non-deleted services; profile need not be APPROVED.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `listMine` → service `listMyServices`.

#### E15 — POST `/api/v1/providers/me/services`

- **Purpose / access:** Create service; PROVIDER.
- **Request:** path none; query `none`; body `CreateService`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 201; `S<OwnService>`; message `Service created`.
- **Rules / next UI behavior:** APPROVED active provider required; category must exist/non-deleted. Server slug = normalized title + last8 profile ID, numeric suffix for collisions.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Category not found; 409 Unable to generate a unique service slug.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `createMine` → service `createService`.

#### E16 — PATCH `/api/v1/providers/me/services/:id`

- **Purpose / access:** Edit service; PROVIDER.
- **Request:** path `id:string`; query `none`; body `PatchService`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<OwnService>`; message `Service updated`.
- **Rules / next UI behavior:** Own non-deleted service; unlike create no approval check. Category changes checked; title changes regenerate slug.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found / Service not found / Category not found; 409 Unable to generate a unique service slug.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `updateMine` → service `updateService`.

#### E17 — DELETE `/api/v1/providers/me/services/:id`

- **Purpose / access:** Delete service; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `Service deleted`.
- **Rules / next UI behavior:** Soft delete; no approval requirement, no active-booking check, no cascading cancellation.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found / Service not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Service/service.controller.ts](src/app/modules/Service/service.controller.ts); [src/app/modules/Service/service.service.ts](src/app/modules/Service/service.service.ts); controller `deleteMine` → service `softDeleteService`.

#### E18 — GET `/api/v1/services/:serviceId/availability`

- **Purpose / access:** Available slots; Public.
- **Request:** path `serviceId:string`; query `QPublicSlots`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<Page<PublicSlot>>`; message `Available slots retrieved`.
- **Rules / next UI behavior:** Unbooked slots subject to public service visibility. Unknown/hidden service returns empty page, not404; past from can expose past slots.
- **Errors:** Shared errors (§3.1); 400 `to must be later than from`.
- **Evidence:** [src/app/modules/Availability/availability.route.ts](src/app/modules/Availability/availability.route.ts); [src/app/modules/Availability/availability.controller.ts](src/app/modules/Availability/availability.controller.ts); [src/app/modules/Availability/availability.service.ts](src/app/modules/Availability/availability.service.ts); controller `listPublic` → service `listPublicAvailability`.

#### E19 — GET `/api/v1/providers/me/availability`

- **Purpose / access:** Own slots; PROVIDER.
- **Request:** path none; query `QOwnSlots`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<OwnSlot>>`; message `Availability slots retrieved`.
- **Rules / next UI behavior:** Own profile existence only, not approval. Lists past/booked slots unless filters exclude them.
- **Errors:** Shared errors (§3.1); 404 Provider profile not found; 400 to must be later than from.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Availability/availability.controller.ts](src/app/modules/Availability/availability.controller.ts); [src/app/modules/Availability/availability.service.ts](src/app/modules/Availability/availability.service.ts); controller `listMine` → service `listMyAvailability`.

#### E20 — POST `/api/v1/providers/me/availability`

- **Purpose / access:** Create slot; PROVIDER.
- **Request:** path none; query `none`; body `CreateSlot`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 201; `S<OwnSlot>`; message `Availability slot created`.
- **Rules / next UI behavior:** APPROVED provider; owned ACTIVE service; future valid times; checks overlap across all services of this provider, adjacent boundaries allowed.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Active service not found; 400 endTime must be later than startTime / startTime must be in the future; 409 Availability slot overlaps an existing provider slot.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Availability/availability.controller.ts](src/app/modules/Availability/availability.controller.ts); [src/app/modules/Availability/availability.service.ts](src/app/modules/Availability/availability.service.ts); controller `createMine` → service `createAvailability`.

#### E21 — PATCH `/api/v1/providers/me/availability/:id`

- **Purpose / access:** Edit slot; PROVIDER.
- **Request:** path `id:string`; query `none`; body `PatchSlot`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<OwnSlot>`; message `Availability slot updated`.
- **Rules / next UI behavior:** Same approval/time/overlap/owned active service requirements as create; refuses booked slot.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Availability slot not found / Active service not found; 400 invalid times; 409 A booked availability slot cannot be changed / Availability slot overlaps an existing provider slot.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Availability/availability.controller.ts](src/app/modules/Availability/availability.controller.ts); [src/app/modules/Availability/availability.service.ts](src/app/modules/Availability/availability.service.ts); controller `updateMine` → service `updateAvailability`.

#### E22 — DELETE `/api/v1/providers/me/availability/:id`

- **Purpose / access:** Delete slot; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `Availability slot deleted`.
- **Rules / next UI behavior:** APPROVED provider; hard delete of own unbooked slot. Existing cancelled/rejected booking FK can still prevent deletion (generic500).
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Availability slot not found; 409 A booked availability slot cannot be deleted.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Availability/availability.controller.ts](src/app/modules/Availability/availability.controller.ts); [src/app/modules/Availability/availability.service.ts](src/app/modules/Availability/availability.service.ts); controller `deleteMine` → service `deleteAvailability`.

#### E23 — POST `/api/v1/bookings`

- **Purpose / access:** Create booking; CUSTOMER.
- **Request:** path none; query `none`; body `CreateBooking`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 201; `S<CustomerBooking>`; message `Booking created`.
- **Rules / next UI behavior:** Valid visible service + matching future slot; atomic isBooked claim; snapshots server price/fee; creates PENDING without Payment record.
- **Errors:** Shared errors (§3.1); 403 An active customer account is required / You cannot book your own service; 404 Available slot not found / Service not found; 409 Slot is no longer available / Slot is already booked.
- **Evidence:** [src/app/modules/Booking/booking.route.ts](src/app/modules/Booking/booking.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `create` → service `createBooking`.

#### E24 — GET `/api/v1/bookings/me`

- **Purpose / access:** Booking history; CUSTOMER.
- **Request:** path none; query `QBookings`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<CustomerBooking>>`; message `Bookings retrieved`.
- **Rules / next UI behavior:** Own bookings including historical related deleted resources.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Booking/booking.route.ts](src/app/modules/Booking/booking.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `listMine` → service `listCustomerBookings`.

#### E25 — GET `/api/v1/bookings/:id`

- **Purpose / access:** Booking detail; CUSTOMER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<CustomerBooking>`; message `Booking retrieved`.
- **Rules / next UI behavior:** Ownership-scoped lookup; foreign ID is404.
- **Errors:** Shared errors (§3.1); 404 Booking not found.
- **Evidence:** [src/app/modules/Booking/booking.route.ts](src/app/modules/Booking/booking.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `getMine` → service `getCustomerBooking`.

#### E26 — PATCH `/api/v1/bookings/:id/cancel`

- **Purpose / access:** Cancel booking; CUSTOMER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<CustomerBooking>`; message `Booking cancelled`.
- **Rules / next UI behavior:** PENDING/ACCEPTED/CONFIRMED only and payment not PAID; sets cancelledAt and frees slot. Returned nested slot may still show pre-release isBooked=true because selected before slot update; refetch.
- **Errors:** Shared errors (§3.1); 404 Booking not found; 409 Booking cannot transition from <from> to CANCELLED / A paid booking cannot be cancelled until refund handling is available.
- **Evidence:** [src/app/modules/Booking/booking.route.ts](src/app/modules/Booking/booking.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `cancel` → service `cancelBooking`.

#### E27 — GET `/api/v1/providers/me/bookings`

- **Purpose / access:** Incoming/active/history jobs; PROVIDER.
- **Request:** path none; query `QBookings`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<ProviderBooking>>`; message `Bookings retrieved`.
- **Rules / next UI behavior:** APPROVED active provider required even for listing.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `listProviderMine` → service `listProviderBookings`.

#### E28 — GET `/api/v1/providers/me/bookings/:id`

- **Purpose / access:** Job detail; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderBooking>`; message `Booking retrieved`.
- **Rules / next UI behavior:** APPROVED active profile and assigned ownership.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Booking not found.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `getProviderMine` → service `getProviderBooking`.

#### E29 — PATCH `/api/v1/providers/me/bookings/:id/accept`

- **Purpose / access:** Accept job; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderBooking>`; message `Booking accepted`.
- **Rules / next UI behavior:** APPROVED active provider and own booking. PENDING → ACCEPTED; slot stays reserved.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Booking not found; 409 Booking cannot transition from <from> to <to>.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `accept` → service `acceptBooking`.

#### E30 — PATCH `/api/v1/providers/me/bookings/:id/reject`

- **Purpose / access:** Reject job; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderBooking>`; message `Booking rejected`.
- **Rules / next UI behavior:** APPROVED active provider and own booking. PENDING → REJECTED; payment must not be PAID; frees slot, but returned slot may be stale true until refetch.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Booking not found; 409 Booking cannot transition from <from> to <to> / A paid booking cannot be rejected until refund handling is available.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `reject` → service `rejectBooking`.

#### E31 — PATCH `/api/v1/providers/me/bookings/:id/start`

- **Purpose / access:** Start job; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderBooking>`; message `Booking started`.
- **Rules / next UI behavior:** APPROVED active provider and own booking. CONFIRMED → IN_PROGRESS; no scheduled-time/start-time gate or separate payment check.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Booking not found; 409 Booking cannot transition from <from> to <to>.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `start` → service `startBooking`.

#### E32 — PATCH `/api/v1/providers/me/bookings/:id/complete`

- **Purpose / access:** Complete job; PROVIDER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderBooking>`; message `Booking completed`.
- **Rules / next UI behavior:** APPROVED active provider and own booking. IN_PROGRESS → COMPLETED; sets completedAt; slot remains booked.
- **Errors:** Shared errors (§3.1); 403 An approved active provider profile is required; 404 Booking not found; 409 Booking cannot transition from <from> to <to>.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Booking/booking.controller.ts](src/app/modules/Booking/booking.controller.ts); [src/app/modules/Booking/booking.service.ts](src/app/modules/Booking/booking.service.ts); controller `complete` → service `completeBooking`.

#### E33 — POST `/api/v1/payments/initiate/:bookingId`

- **Purpose / access:** Start Checkout; CUSTOMER.
- **Request:** path `bookingId:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 201; `S<Checkout>`; message `Payment session created`.
- **Rules / next UI behavior:** Own ACCEPTED booking only; create/reuse Payment; create Stripe session; set PENDING and transactionId=session.id. No idempotency/reuse-existing-session protection.
- **Errors:** Shared errors (§3.1); 404 Booking not found; 409 Only accepted bookings can be paid / Booking is already paid; 503 Stripe payments are not configured; 400 Invalid payment amount; 502 Stripe did not return a checkout URL.
- **Evidence:** [src/app/modules/Payment/payment.route.ts](src/app/modules/Payment/payment.route.ts); [src/app/modules/Payment/payment.controller.ts](src/app/modules/Payment/payment.controller.ts); [src/app/modules/Payment/payment.service.ts](src/app/modules/Payment/payment.service.ts); controller `initiate` → service `initiatePayment`.

#### E34 — GET `/api/v1/payments/booking/:bookingId`

- **Purpose / access:** Payment reconciliation; CUSTOMER.
- **Request:** path `bookingId:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<PaymentState>`; message `Payment status retrieved`.
- **Rules / next UI behavior:** Own booking; if no record, payment is only {status:UNPAID}. Returns currency.
- **Errors:** Shared errors (§3.1); 404 Booking not found.
- **Evidence:** [src/app/modules/Payment/payment.route.ts](src/app/modules/Payment/payment.route.ts); [src/app/modules/Payment/payment.controller.ts](src/app/modules/Payment/payment.controller.ts); [src/app/modules/Payment/payment.service.ts](src/app/modules/Payment/payment.service.ts); controller `status` → service `getPaymentStatus`.

#### E35 — POST `/api/v1/payments/stripe/webhook`

- **Purpose / access:** Gateway event; Stripe signature.
- **Request:** path none; query `none`; body `Raw Stripe event`. Headers: `stripe-signature`, `Content-Type: application/json` (raw signed payload).
- **Success:** HTTP 200; `{received:true}` (no envelope).
- **Rules / next UI behavior:** Mounted in app.ts before JSON/rate limit; requires stripe-signature and raw application/json Buffer. Handles completed Checkout and failed PaymentIntent only; other valid events acknowledged.
- **Errors:** Shared errors (§3.1); 400 Invalid Stripe webhook request / Stripe checkout metadata is invalid / Stripe amount or currency does not match payment; 503 Stripe webhook is not configured / Stripe payments are not configured; 404 Payment not found; 409 Booking cannot be confirmed; invalid signature is uncaught Stripe error →500.
- **Evidence:** [src/app.ts](src/app.ts); [src/app/modules/Payment/payment.controller.ts](src/app/modules/Payment/payment.controller.ts); [src/app/modules/Payment/payment.service.ts](src/app/modules/Payment/payment.service.ts); controller `webhook` → service `finalizeCheckout / markPaymentFailed`.

#### E36 — POST `/api/v1/reviews`

- **Purpose / access:** Write review; CUSTOMER.
- **Request:** path none; query `none`; body `CreateReview`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 201; `S<OwnReview>`; message `Review created`.
- **Rules / next UI behavior:** Own COMPLETED booking only, one lifetime review per booking including soft-deleted rows.
- **Errors:** Shared errors (§3.1); 404 Completed booking not found; 409 A review already exists for this booking.
- **Evidence:** [src/app/modules/Review/review.route.ts](src/app/modules/Review/review.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `create` → service `createReview`.

#### E37 — GET `/api/v1/reviews/me`

- **Purpose / access:** Own reviews; CUSTOMER.
- **Request:** path none; query `QReviews`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<OwnReview>>`; message `Reviews retrieved`.
- **Rules / next UI behavior:** Own non-deleted reviews. No bookingId filter; use returned bookingId locally.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Review/review.route.ts](src/app/modules/Review/review.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `mine` → service `listMyReviews`.

#### E38 — PATCH `/api/v1/reviews/:id`

- **Purpose / access:** Edit review; CUSTOMER.
- **Request:** path `id:string`; query `none`; body `PatchReview`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<OwnReview>`; message `Review updated`.
- **Rules / next UI behavior:** Own non-deleted review; does not recalculate stored ProviderProfile rating.
- **Errors:** Shared errors (§3.1); 404 Review not found.
- **Evidence:** [src/app/modules/Review/review.route.ts](src/app/modules/Review/review.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `update` → service `updateReview`.

#### E39 — DELETE `/api/v1/reviews/:id`

- **Purpose / access:** Delete review; CUSTOMER.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `Review deleted`.
- **Rules / next UI behavior:** Own non-deleted review soft-deleted; no restore or replacement review route.
- **Errors:** Shared errors (§3.1); 404 Review not found.
- **Evidence:** [src/app/modules/Review/review.route.ts](src/app/modules/Review/review.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `remove` → service `softDeleteReview`.

#### E40 — GET `/api/v1/services/:serviceId/reviews`

- **Purpose / access:** Public services reviews; Public.
- **Request:** path `serviceId:string`; query `QReviews`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<Page<PublicReview>>`; message `Reviews retrieved`.
- **Rules / next UI behavior:** Filters non-deleted reviews only; does NOT enforce parent service/provider/customer public visibility; missing parent returns empty page.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Service/service.route.ts](src/app/modules/Service/service.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `publicService` → service `listPublicReviews`.

#### E41 — GET `/api/v1/services/:serviceId/rating-summary`

- **Purpose / access:** Live services rating; Public.
- **Request:** path `serviceId:string`; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<RatingSummary>`; message `Rating summary retrieved`.
- **Rules / next UI behavior:** Live non-deleted review aggregate; no parent visibility check; missing/no reviews returns averageRating0/reviewCount0.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Service/service.route.ts](src/app/modules/Service/service.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `serviceSummary` → service `ratingSummary`.

#### E42 — GET `/api/v1/providers/:providerId/reviews`

- **Purpose / access:** Public providers reviews; Public.
- **Request:** path `providerId:string`; query `QReviews`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<Page<PublicReview>>`; message `Reviews retrieved`.
- **Rules / next UI behavior:** Filters non-deleted reviews only; does NOT enforce parent service/provider/customer public visibility; missing parent returns empty page.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `publicProvider` → service `listPublicReviews`.

#### E43 — GET `/api/v1/providers/:providerId/rating-summary`

- **Purpose / access:** Live providers rating; Public.
- **Request:** path `providerId:string`; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<RatingSummary>`; message `Rating summary retrieved`.
- **Rules / next UI behavior:** Live non-deleted review aggregate; no parent visibility check; missing/no reviews returns averageRating0/reviewCount0.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Provider/provider.route.ts](src/app/modules/Provider/provider.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `providerSummary` → service `ratingSummary`.

#### E44 — GET `/api/v1/admin/dashboard/overview`

- **Purpose / access:** Marketplace counts; ADMIN.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Overview>`; message `Dashboard overview retrieved`.
- **Rules / next UI behavior:** Entity counts exclude entity soft deletions; provider counts also exclude deleted users, not suspended users. Booking/payment counts include history; UNPAID count counts existing rows only.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `overview` → service `getDashboardOverview`.

#### E45 — GET `/api/v1/admin/dashboard/revenue`

- **Purpose / access:** Revenue totals; ADMIN.
- **Request:** path none; query `QRevenue`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Revenue>`; message `Revenue dashboard retrieved`.
- **Rules / next UI behavior:** Only bookings with PAID payment; sums booking totalAmount/platformFee. Filter is booking creation date; no time-series or currency field.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `revenue` → service `getRevenueDashboard`.

#### E46 — GET `/api/v1/admin/dashboard/bookings`

- **Purpose / access:** Booking analytics; ADMIN.
- **Request:** path none; query `QBookingMetrics`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<BookingMetrics>`; message `Booking dashboard retrieved`.
- **Rules / next UI behavior:** All statuses; rates are percentages rounded2; denominator all filtered bookings, 0 on no bookings.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `bookings` → service `getBookingDashboard`.

#### E47 — GET `/api/v1/admin/dashboard/providers`

- **Purpose / access:** Provider analytics; ADMIN.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ProviderMetrics>`; message `Provider dashboard retrieved`.
- **Rules / next UI behavior:** Top5 by completed booking count; totalRevenue is completed booking totalAmount sum, not provider net/withdrawable amount; live review aggregate.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `providers` → service `getProviderDashboard`.

#### E48 — GET `/api/v1/admin/dashboard/services`

- **Purpose / access:** Service analytics; ADMIN.
- **Request:** path none; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<ServiceMetrics>`; message `Service dashboard retrieved`.
- **Rules / next UI behavior:** Top10 candidate groups then filter deleted services and take5. Counts can include inactive services; rankings can be shorter than5.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `services` → service `getServiceDashboard`.

#### E49 — GET `/api/v1/admin/dashboard/recent-activity`

- **Purpose / access:** Recent audit activity; ADMIN.
- **Request:** path none; query `QActivity`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Activity[]>`; message `Recent activity retrieved`.
- **Rules / next UI behavior:** Newest audit records only, no pagination metadata and not notifications.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `recentActivity` → service `getRecentActivity`.

#### E50 — GET `/api/v1/admin/audit-logs`

- **Purpose / access:** Audit list; ADMIN.
- **Request:** path none; query `QAudit`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<Audit>>`; message `Audit logs retrieved`.
- **Rules / next UI behavior:** Exact filters/date range and recursive snapshot sanitation.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `auditLogs` → service `listAuditLogs`.

#### E51 — GET `/api/v1/admin/audit-logs/:id`

- **Purpose / access:** Audit detail; ADMIN.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Audit>`; message `Audit log retrieved`.
- **Rules / next UI behavior:** Single sanitized audit record.
- **Errors:** Shared errors (§3.1); 404 Audit log not found.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/dashboard.controller.ts](src/app/modules/Admin/dashboard.controller.ts); [src/app/modules/Admin/dashboard.service.ts](src/app/modules/Admin/dashboard.service.ts); controller `auditLog` → service `getAuditLog`.

#### E52 — GET `/api/v1/admin/users`

- **Purpose / access:** User management list; ADMIN.
- **Request:** path none; query `QUsers`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<AdminUser>>`; message `Users retrieved`.
- **Rules / next UI behavior:** Non-deleted users; provider relation is selected without separate deleted filter.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `getUsers` → service `listUsers`.

#### E53 — GET `/api/v1/admin/users/:id`

- **Purpose / access:** User detail; ADMIN.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<AdminUser>`; message `User retrieved`.
- **Rules / next UI behavior:** Non-deleted user.
- **Errors:** Shared errors (§3.1); 404 User not found.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `getUser` → service `getAdminUser`.

#### E54 — PATCH `/api/v1/admin/users/:id/status`

- **Purpose / access:** User moderation; ADMIN.
- **Request:** path `id:string`; query `none`; body `UserStatusBody`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<AdminUser>`; message `User status updated`.
- **Rules / next UI behavior:** Any different enum status; cannot suspend/block self. Other admins are not specially protected.
- **Errors:** Shared errors (§3.1); 400 Administrators cannot suspend or block themselves / User already has this status; 404 User not found.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `updateUserStatus` → service `changeUserStatus`.

#### E55 — DELETE `/api/v1/admin/users/:id`

- **Purpose / access:** Delete user; ADMIN.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `User deleted`.
- **Rules / next UI behavior:** Soft delete user and, for PROVIDER role, profile; no booking/payment cancellation. Cannot self-delete.
- **Errors:** Shared errors (§3.1); 400 Administrators cannot delete themselves; 404 User not found.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `deleteUser` → service `softDeleteUser`.

#### E56 — GET `/api/v1/admin/providers`

- **Purpose / access:** Provider moderation list; ADMIN.
- **Request:** path none; query `QProviders`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<AdminProvider>>`; message `Providers retrieved`.
- **Rules / next UI behavior:** Non-deleted profiles with non-deleted user; user ACTIVE not required for listing.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `getProviders` → service `listProviders`.

#### E57 — PATCH `/api/v1/admin/providers/:id/status`

- **Purpose / access:** Provider approval/rejection; ADMIN.
- **Request:** path `id:string`; query `none`; body `ProviderStatusBody`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<AdminProvider>`; message `Provider status updated`.
- **Rules / next UI behavior:** Target user must be ACTIVE; any different ProviderStatus including back to PENDING is allowed.
- **Errors:** Shared errors (§3.1); 404 Provider not found; 400 Provider user must be active before status can be changed / Provider already has this status.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Admin/admin.service.ts](src/app/modules/Admin/admin.service.ts); controller `updateProviderStatus` → service `changeProviderStatus`.

#### E58 — GET `/api/v1/admin/categories`

- **Purpose / access:** Category management list; ADMIN.
- **Request:** path none; query `QCategories`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<Category>>`; message `Categories retrieved`.
- **Rules / next UI behavior:** Non-deleted categories; service function is Category/category.service.ts.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Category/category.service.ts](src/app/modules/Category/category.service.ts); controller `getCategories` → service `getAdminCategories`.

#### E59 — POST `/api/v1/admin/categories`

- **Purpose / access:** Create category; ADMIN.
- **Request:** path none; query `none`; body `CreateCategory`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 201; `S<Category>`; message `Category created`.
- **Rules / next UI behavior:** Category/category.service.ts; name and slug unique even across soft-deleted records; generated slug is not revalidated by Zod.
- **Errors:** Shared errors (§3.1); 409 A category with this slug already exists / A category with this name already exists.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Category/category.service.ts](src/app/modules/Category/category.service.ts); controller `createCategory` → service `createCategory`.

#### E60 — PATCH `/api/v1/admin/categories/:id`

- **Purpose / access:** Edit category; ADMIN.
- **Request:** path `id:string`; query `none`; body `PatchCategory`. Headers: `Authorization: Bearer <accessToken>`; `Content-Type: application/json`.
- **Success:** HTTP 200; `S<Category>`; message `Category updated`.
- **Rules / next UI behavior:** Category/category.service.ts; rename may regenerate slug.
- **Errors:** Shared errors (§3.1); 404 Category not found; 409 A category with this slug already exists / A category with this name already exists.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Category/category.service.ts](src/app/modules/Category/category.service.ts); controller `patchCategory` → service `updateCategory`.

#### E61 — DELETE `/api/v1/admin/categories/:id`

- **Purpose / access:** Delete category; ADMIN.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `Category deleted`.
- **Rules / next UI behavior:** Category/category.service.ts; soft delete blocked by ACTIVE non-deleted services (including hidden providers).
- **Errors:** Shared errors (§3.1); 404 Category not found; 409 Cannot delete a category with active services.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Admin/admin.controller.ts](src/app/modules/Admin/admin.controller.ts); [src/app/modules/Category/category.service.ts](src/app/modules/Category/category.service.ts); controller `deleteCategory` → service `softDeleteCategory`.

#### E62 — GET `/api/v1/admin/reviews`

- **Purpose / access:** Review moderation list; ADMIN.
- **Request:** path none; query `QAdminReviews`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<Page<AdminReview>>`; message `Reviews retrieved`.
- **Rules / next UI behavior:** Includes deleted reviews and related providerId; distinguishes by deletedAt.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `adminList` → service `listAdminReviews`.

#### E63 — DELETE `/api/v1/admin/reviews/:id`

- **Purpose / access:** Moderate review; ADMIN.
- **Request:** path `id:string`; query `none`; body `none`. Headers: `Authorization: Bearer <accessToken>`.
- **Success:** HTTP 200; `S<null>`; message `Review deleted`.
- **Rules / next UI behavior:** Any non-deleted review; soft delete with REVIEW_ADMIN_DELETED audit; no restore.
- **Errors:** Shared errors (§3.1); 404 Review not found.
- **Evidence:** [src/app/modules/Admin/admin.route.ts](src/app/modules/Admin/admin.route.ts); [src/app/modules/Review/review.controller.ts](src/app/modules/Review/review.controller.ts); [src/app/modules/Review/review.service.ts](src/app/modules/Review/review.service.ts); controller `adminRemove` → service `softDeleteReview`.

#### E64 — GET `/health`

- **Purpose / access:** Health; Public.
- **Request:** path none; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<null>`; message `Servexa API is healthy`.
- **Rules / next UI behavior:** Liveness response only; does not probe DB/Stripe connectivity.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app.ts](src/app.ts); controller `(inline)` → service `(inline)`.

#### E65 — GET `/payments/success`

- **Purpose / access:** Checkout success redirect; Public.
- **Request:** path none; query `ignored session_id`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<null>`; message `Payment completed. Final status is confirmed by Stripe webhook.`.
- **Rules / next UI behavior:** Root route returns JSON, no HTML UI; session_id not used to find/verify booking.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app.ts](src/app.ts); controller `(inline)` → service `(inline)`.

#### E66 — GET `/payments/cancel`

- **Purpose / access:** Checkout cancel redirect; Public.
- **Request:** path none; query `none`; body `none`. Headers: none required.
- **Success:** HTTP 200; `S<null>`; message `Stripe Checkout was cancelled. Payment status was not changed by this redirect.`.
- **Rules / next UI behavior:** Root route returns JSON; does not mutate Payment/Booking or release slot.
- **Errors:** Shared errors (§3.1); no additional explicit business error branch.
- **Evidence:** [src/app.ts](src/app.ts); controller `(inline)` → service `(inline)`.

## 4. Authentication and authorization

**Register:** POST `/api/v1/auth/register` with explicit CUSTOMER/PROVIDER → 201 AuthUser → POST login. Provider profile begins PENDING. No automatic login, welcome email, verification or OTP. ADMIN provisioning API/seed is NOT FOUND.

**Login:** POST `/api/v1/auth/login` → TokenPair in `data`, without user → GET `/api/v1/auth/me` or `/api/v1/users/me` using Bearer → store current role/profile status from response → render authorized navigation. Default expiry access15m/refresh30d is configurable; response has no expiresIn. JWT claims include userId, role, tokenType plus JWT timestamps. Login of a PENDING/REJECTED provider works if User.status ACTIVE.

**Refresh:** on protected 401, frontend contract is to serialize refresh attempts → POST `/auth/refresh-token` with saved refreshToken → replace both tokens → retry once. DB hash must be unrevoked/unexpired, user active/non-deleted, JWT role must match DB role. Transaction revokes old row and creates replacement. If refresh fails401, clear local auth and return to login; do not retry forever. There is no “all devices” or session listing API.

**Logout:** POST `/auth/logout` body refreshToken, no access token required → 200/null; remove frontend session. Access JWT remains usable until expiry while user remains active. A nonmatching token still returns success. Token storage medium is **UNSPECIFIED**: backend returns JSON, sets no cookies, mandates no localStorage/sessionStorage mechanism. Do not describe HttpOnly cookie sessions as implemented. Decide browser persistence as frontend architecture, keeping tokens out of URLs/logs/public state.

**Database role wins:** auth middleware verifies token then reads active/non-deleted user and uses current DB role for authorization, not only JWT role. Suspension/deletion causes protected requests401 and fresh login403; restoring user ACTIVE may allow still-valid old access JWT. Refresh rows are not revoked by status change/deletion; refresh checks current user state.

**Important token limitation:** `jwtHelper.ts` adds no random jti/session ID. Identical claims signed in the same second can produce identical tokens; rotation cannot be assumed to yield a distinct token string. Multiple same-second login rows can have the same tokenHash. Serialize client refresh, but backend replay/rotation assurance remains NEEDS VERIFICATION.

Forgot/reset/change password, email verification, OTP, social login, magic links, permission scopes, cookie sessions: **NOT FOUND**. Do not build functioning screens for those flows. Evidence: `Auth/*`, `src/helpers/jwtHelper.ts`, `src/app/middlewares/auth.ts`, `src/utils/tokenHash.ts`.

## 5. User types and role capabilities

| Role | Allowed APIs/actions | Restrictions | Backend-derived dashboard/profile |
|---|---|---|---|
| Visitor | Public categories/services/slots/provider detail/reviews/rating, register/login/refresh/logout | No writes to marketplace; no public provider index | Catalog, service/provider detail, auth |
| CUSTOMER | Any-auth profile, `/bookings*`, `/payments/initiate/*`, `/payments/booking/*`, `/reviews*` own resources | Cannot act as provider/admin; foreign booking/review returns404 | Own booking list/detail and embedded payment status, profile, own reviews; no dedicated customer dashboard API |
| PROVIDER | Any-auth profile, provider self/profile/services/availability/jobs; own public review views | Create service, all slot mutations, all booking operations require APPROVED; profile edit/service read-edit-delete do not | Service manager, slots, requests/active/history, provider profile/status; no earnings/withdrawals API |
| ADMIN | `/admin/*`, any-auth own user profile, public APIs | Does not inherit CUSTOMER/PROVIDER routes; cannot self-delete/suspend/block; cannot change user roles | Metrics, users, providers, categories, review moderation, audit |

No WORKER/SUPER_ADMIN roles. Provider user ID and provider profile ID are distinct; booking assignment points to profile. No custom permissions/grants. Evidence: routes and service guards, `prisma/schema.prisma` enums.

## 6. Core business logic

| Frontend action | API sequence | Backend processing → state → response | Next frontend action |
|---|---|---|---|
| Browse/discover | GET categories → GET services with filters | Public visibility + pagination → Page<PublicService> | Detail by service.id |
| Provider choice | From service.provider.id → GET providers/:id; GET services?provider=<profileId> | Each Service has exactly one provider; no generic service with multiple provider offers | Choose that provider's service/slot |
| Schedule | GET services/:serviceId/availability | Available slot records, fixed start/end | Present server slots, send selected slotId |
| Book | POST bookings {serviceId,slotId,notes?} | Validate visibility/future/match; conditionally mark booked; snapshot prices; create PENDING | Show request awaiting provider; no payment button before ACCEPTED |
| Assign | Included in createBooking | Provider derived from slot/service, no dispatcher/worker assignment | No assignment UI |
| Accept/reject | Provider PATCH .../accept or .../reject | PENDING → ACCEPTED/REJECTED; reject releases isBooked | Customer refetch; accepted can pay |
| Pay/confirm | POST payments/initiate/:bookingId → navigate paymentUrl → webhook → GET payments/booking/:bookingId | PENDING payment → PAID; ACCEPTED booking → CONFIRMED | Wait for server status, then tracking |
| Start/finish | Provider PATCH .../start then .../complete | CONFIRMED → IN_PROGRESS → COMPLETED; completedAt set | Customer review form |
| Cancel | Customer PATCH bookings/:id/cancel | Eligible state and not PAID → CANCELLED; cancelledAt + free flag | Refetch booking/availability; slot reuse caveat |
| Review | POST reviews then GET service/provider rating-summary | Own completed booking → one Review; live aggregates calculated | Show review; edit/delete via review.id |

Availability is explicit slot inventory, not recurring hours. No reschedule, cart, quantity, customer address, GPS, dispute/refund, chat/support, multi-worker assignment, coupon/tax or notification workflow exists. Free-form notes may contain text but are not a structured address contract. Evidence: Booking/Availability/Payment/Review service functions and strict validators.

## 7. Booking state machine

| Current state and meaning | Next state | Actor / API | Additional rule |
|---|---|---|---|
| PENDING: submitted/reserved | ACCEPTED | Provider PATCH `/providers/me/bookings/:id/accept` | Approved assigned provider |
| PENDING | REJECTED | Provider PATCH `.../:id/reject` | Payment !=PAID; frees slot flag |
| PENDING | CANCELLED | Customer PATCH `/bookings/:id/cancel` | Own booking, payment !=PAID |
| ACCEPTED: provider agreed, awaiting payment | CONFIRMED | Signed Stripe `checkout.session.completed` | Paid session, matching metadata/session ID/amount/currency |
| ACCEPTED | CANCELLED | Customer cancel | Payment !=PAID, including PENDING payment |
| CONFIRMED: payment-confirmed normal flow | IN_PROGRESS | Provider PATCH `.../:id/start` | Approved assigned provider; no timing gate |
| CONFIRMED | CANCELLED | Customer cancel | Transition table allows it, but PAID normally blocks it |
| IN_PROGRESS: work started | COMPLETED | Provider PATCH `.../:id/complete` | Sets completedAt |
| COMPLETED: finished | none | None | Review creation available |
| CANCELLED: customer cancelled | none | None | No reopen/reschedule/refund |
| REJECTED: provider declined | none | None | No reopen |

Every transition not listed is invalid →409 `Booking cannot transition from X to Y`. Repeating accept/start/complete is not idempotent. No direct “confirm” client endpoint. Payment finalization also accepts an already CONFIRMED booking for an unpaid matching payment; a matching already-PAID payment returns early. Evidence: `Booking/booking.service.ts::transition/updateProviderBooking/cancelBooking`, `Payment/payment.service.ts::finalizeCheckout`.

The transition checks read state before transactions; update operations do not include the previous status in the WHERE clause. Concurrent actors/webhooks can therefore race. Treat this as a backend integrity limitation; UI button guards are not concurrency protection. Slot flag is retained on completion and normal payment failure.

## 8. Service provider flow

Register PROVIDER → login → GET providers/me → show PENDING approval → admin sets APPROVED → POST providers/me/services → POST providers/me/availability → GET providers/me/bookings?status=PENDING → accept/reject → wait for CONFIRMED → start → complete. Use the same booking list filtered by status for active/history tabs; do not assume combined status arrays supported.

Profile editing accepts businessName/bio/phone/city/address; no identity documents, avatar, verification upload or rejection reason. Approval is administrative ProviderStatus only. Service updates/deletion remain callable for PENDING/REJECTED providers, whereas create/slot mutation/job listing/actions are approval-gated. Slot overlap is across all services belonging to the provider, with exact boundary adjacency allowed; no duration alignment, recurring schedule or vacation model.

Provider receives customer name/phone in ProviderBooking, not customer email/address/GPS. Reviews are accessible via own profile ID's public review/summary APIs; there is no provider-only review management route. Earnings, balances, payouts, withdrawal history, notifications and online/offline switch: NOT FOUND. Admin analytics providerRevenue is not a provider payout API. Evidence: `Provider/provider.route.ts`, Service/Availability/Booking services.

## 9. Customer flow

| Capability | Actual dependency / limit |
|---|---|
| Register/login/profile | Auth APIs + GET/PATCH users/me; profile only name/phone editable |
| Catalog/search/filter | GET categories, GET services using QServices |
| Details/provider | GET services/:id; GET providers/:id; public reviews/summaries |
| Schedule/book | GET service availability → POST bookings with fixed slotId |
| Address/location | No structured customer address fields/API; serviceArea and provider city/address are descriptive text |
| Payment | POST initiate for ACCEPTED booking → hosted Checkout → GET payment status |
| Tracking/history | GET bookings/me, GET bookings/:id; no realtime |
| Cancellation | PATCH bookings/:id/cancel; state and PAID restrictions |
| Review | POST reviews for completed booking; own list/update/delete |
| Support/notifications/refund/reschedule | NOT FOUND |

Customer dashboard is a frontend composition of own list endpoints, not server-wide totals. A paginated current page is not a total-status counter; use a filtered query's meta.total if needed. Do not infer total spend from a partial page.

## 10. Admin functionality

Implemented: user list/detail/status/soft-delete; provider list/status approval; category list/create/update/soft-delete; all-review list/soft-delete; six dashboard read APIs and audit list/detail. Full contracts are E entries and matrix §24.

Not implemented: admin booking list/detail/manual transition/reassignment; admin payment list/detail/refund; service mutation/moderation; provider identity verification documents; complaints/disputes; notification sending; runtime settings; role editing; admin creation. Dashboard bookings/services/payments counts are analytics, not CRUD authorization.

Metrics semantics matter: overview entities exclude their deletedAt but provider counts can include suspended users; booking/payment history remains counted. Revenue filters Booking.createdAt and includes PAID payments, sums totalAmount and platformFee, derives providerRevenue = gross-platform. Provider ranking sums completed-booking totalAmount (not net earnings), while most-booked-service ranking includes all booking statuses. No currency field/time-series is returned from revenue dashboard. Audit recent activity is an event log, not an inbox. Evidence: `Admin/admin.route.ts`, `Admin/admin.service.ts`, `Admin/dashboard.service.ts`.

## 11. Database and data models

The table below is generated from `prisma/schema.prisma` so every field, relation, nullability and schema default is retained. DB fields are **not automatically exposed** by APIs; use §3.2 selections. In schema types `?` = nullable/optional relation; `[]` = relation collection. String/Int/Boolean/DateTime/Decimal/Json map to strings/numbers/booleans/ISO strings/decimal strings/arbitrary JSON at API serialization. API validators impose additional rules beyond DB nullability. Money is Decimal(12,2), profile rating Decimal(3,2).

### User

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `name` | `String` | non-null | `—` |

| `email` | `String` | non-null | `@unique` |

| `password` | `String` | non-null | `—` |

| `phone` | `String` | non-null | `—` |

| `role` | `UserRole` | non-null | `@default(CUSTOMER)` |

| `status` | `UserStatus` | non-null | `@default(ACTIVE)` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `deletedAt` | `DateTime?` | nullable | `—` |

| `providerProfile` | `ProviderProfile?` | nullable | `—` |

| `customerBookings` | `Booking[]` | relation collection | `@relation("CustomerBookings")` |

| `reviews` | `Review[]` | relation collection | `—` |

| `payments` | `Payment[]` | relation collection | `—` |

| `refreshTokens` | `RefreshToken[]` | relation collection | `—` |

| `auditLogs` | `AuditLog[]` | relation collection | `—` |

Model constraints/indexes: `@@index([role, status])`; `@@index([deletedAt])`.

### ProviderProfile

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `userId` | `String` | non-null | `@unique` |

| `businessName` | `String` | non-null | `—` |

| `bio` | `String?` | nullable | `—` |

| `phone` | `String` | non-null | `—` |

| `city` | `String` | non-null | `—` |

| `address` | `String` | non-null | `—` |

| `status` | `ProviderStatus` | non-null | `@default(PENDING)` |

| `rating` | `Decimal` | non-null | `@default(0) @db.Decimal(3, 2)` |

| `totalReviews` | `Int` | non-null | `@default(0)` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `deletedAt` | `DateTime?` | nullable | `—` |

| `user` | `User` | non-null | `@relation(fields: [userId], references: [id])` |

| `services` | `Service[]` | relation collection | `—` |

| `slots` | `AvailabilitySlot[]` | relation collection | `—` |

| `bookings` | `Booking[]` | relation collection | `—` |

Model constraints/indexes: `@@index([status])`; `@@index([city])`; `@@index([deletedAt])`.

### Category

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `name` | `String` | non-null | `@unique` |

| `slug` | `String` | non-null | `@unique` |

| `description` | `String?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `deletedAt` | `DateTime?` | nullable | `—` |

| `services` | `Service[]` | relation collection | `—` |

Model constraints/indexes: `@@index([deletedAt])`.

### Service

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `providerId` | `String` | non-null | `—` |

| `categoryId` | `String` | non-null | `—` |

| `title` | `String` | non-null | `—` |

| `slug` | `String` | non-null | `@unique` |

| `description` | `String?` | nullable | `—` |

| `price` | `Decimal` | non-null | `@db.Decimal(12, 2)` |

| `duration` | `Int` | non-null | `—` |

| `imageUrl` | `String?` | nullable | `—` |

| `serviceArea` | `String?` | nullable | `—` |

| `status` | `ServiceStatus` | non-null | `@default(ACTIVE)` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `deletedAt` | `DateTime?` | nullable | `—` |

| `provider` | `ProviderProfile` | non-null | `@relation(fields: [providerId], references: [id])` |

| `category` | `Category` | non-null | `@relation(fields: [categoryId], references: [id])` |

| `slots` | `AvailabilitySlot[]` | relation collection | `—` |

| `bookings` | `Booking[]` | relation collection | `—` |

| `reviews` | `Review[]` | relation collection | `—` |

Model constraints/indexes: `@@index([providerId])`; `@@index([categoryId])`; `@@index([status])`; `@@index([price])`; `@@index([createdAt])`; `@@index([deletedAt])`.

### AvailabilitySlot

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `providerId` | `String` | non-null | `—` |

| `serviceId` | `String` | non-null | `—` |

| `startTime` | `DateTime` | non-null | `—` |

| `endTime` | `DateTime` | non-null | `—` |

| `isBooked` | `Boolean` | non-null | `@default(false)` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `provider` | `ProviderProfile` | non-null | `@relation(fields: [providerId], references: [id])` |

| `service` | `Service` | non-null | `@relation(fields: [serviceId], references: [id])` |

| `booking` | `Booking?` | nullable | `@relation("BookingSlot")` |

Model constraints/indexes: `@@unique([providerId, serviceId, startTime, endTime])`; `@@index([providerId])`; `@@index([serviceId])`; `@@index([startTime])`; `@@index([isBooked])`.

### Booking

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `customerId` | `String` | non-null | `—` |

| `providerId` | `String` | non-null | `—` |

| `serviceId` | `String` | non-null | `—` |

| `slotId` | `String` | non-null | `@unique` |

| `status` | `BookingStatus` | non-null | `@default(PENDING)` |

| `servicePrice` | `Decimal` | non-null | `@db.Decimal(12, 2)` |

| `platformFee` | `Decimal` | non-null | `@db.Decimal(12, 2)` |

| `totalAmount` | `Decimal` | non-null | `@db.Decimal(12, 2)` |

| `notes` | `String?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `cancelledAt` | `DateTime?` | nullable | `—` |

| `completedAt` | `DateTime?` | nullable | `—` |

| `customer` | `User` | non-null | `@relation("CustomerBookings", fields: [customerId], references: [id])` |

| `provider` | `ProviderProfile` | non-null | `@relation(fields: [providerId], references: [id])` |

| `service` | `Service` | non-null | `@relation(fields: [serviceId], references: [id])` |

| `slot` | `AvailabilitySlot` | non-null | `@relation("BookingSlot", fields: [slotId], references: [id])` |

| `payment` | `Payment?` | nullable | `—` |

| `review` | `Review?` | nullable | `—` |

Model constraints/indexes: `@@index([customerId])`; `@@index([providerId])`; `@@index([serviceId])`; `@@index([status])`; `@@index([createdAt])`.

### Payment

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `bookingId` | `String` | non-null | `@unique` |

| `userId` | `String` | non-null | `—` |

| `amount` | `Decimal` | non-null | `@db.Decimal(12, 2)` |

| `status` | `PaymentStatus` | non-null | `@default(UNPAID)` |

| `provider` | `PaymentProvider` | non-null | `—` |

| `transactionId` | `String?` | nullable | `@unique` |

| `gatewayResponse` | `Json?` | nullable | `—` |

| `paidAt` | `DateTime?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `booking` | `Booking` | non-null | `@relation(fields: [bookingId], references: [id])` |

| `user` | `User` | non-null | `@relation(fields: [userId], references: [id])` |

Model constraints/indexes: `@@index([status])`.

### Review

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `bookingId` | `String` | non-null | `@unique` |

| `customerId` | `String` | non-null | `—` |

| `serviceId` | `String` | non-null | `—` |

| `rating` | `Int` | non-null | `—` |

| `comment` | `String?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `updatedAt` | `DateTime` | non-null | `@updatedAt` |

| `deletedAt` | `DateTime?` | nullable | `—` |

| `booking` | `Booking` | non-null | `@relation(fields: [bookingId], references: [id])` |

| `customer` | `User` | non-null | `@relation(fields: [customerId], references: [id])` |

| `service` | `Service` | non-null | `@relation(fields: [serviceId], references: [id])` |

Model constraints/indexes: `@@index([customerId])`; `@@index([serviceId])`; `@@index([deletedAt])`.

### RefreshToken

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `userId` | `String` | non-null | `—` |

| `tokenHash` | `String` | non-null | `—` |

| `expiresAt` | `DateTime` | non-null | `—` |

| `revokedAt` | `DateTime?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `user` | `User` | non-null | `@relation(fields: [userId], references: [id])` |

Model constraints/indexes: `@@index([userId])`; `@@index([expiresAt])`.

### AuditLog

| Field | Prisma type | Required/nullability | Default, relation or constraint |
|---|---|---|---|

| `id` | `String` | non-null | `@id @default(cuid())` |

| `userId` | `String?` | nullable | `—` |

| `action` | `String` | non-null | `—` |

| `entityType` | `String` | non-null | `—` |

| `entityId` | `String` | non-null | `—` |

| `oldData` | `Json?` | nullable | `—` |

| `newData` | `Json?` | nullable | `—` |

| `ipAddress` | `String?` | nullable | `—` |

| `userAgent` | `String?` | nullable | `—` |

| `createdAt` | `DateTime` | non-null | `@default(now())` |

| `user` | `User?` | nullable | `@relation(fields: [userId], references: [id])` |

Model constraints/indexes: `@@index([userId])`; `@@index([entityType, entityId])`; `@@index([createdAt])`.

### Relationship and integrity interpretation

`User 1 → 0..1 ProviderProfile`; `ProviderProfile 1 → many Service`; `Category 1 → many Service`; provider+service own many slots. `Booking` has one customer User, ProviderProfile, Service and **unique** slot. `Booking 1 → 0..1 Payment` and `Booking 1 → 0..1 Review`; Review also directly references User and Service. There is no many-to-many generic Service↔Provider offering table. `AuditLog.user` may be null; payment/refreshtoken user relation required.

`Booking.slotId`, `Review.bookingId`, `Payment.bookingId` remain unique after cancellation or soft deletion. Migration uses ON DELETE RESTRICT for the required business relations; AuditLog.user uses SET NULL. Slot hard deletion cannot remove a slot referenced by a retained booking. Soft-deleting user/provider/service does not physically remove booking/payment history. Currency has no dedicated Payment/Booking DB column; it is global config (and temporary gatewayResponse data), so changing global currency risks interpreting old records differently.

No DB check constraint for slot overlap, end>start, service duration, positive amounts or rating1–5 exists in the inspected migration; some are application-level validation only. No exclusion constraint/serializable transaction setting protects overlapping slot creation. Evidence: schema and migration, `Availability/availability.service.ts::rejectOverlap`.

## 12. File and image upload

Upload/delete-file endpoints, multipart parser, storage bucket, signed URLs, file size/type checks: **NOT FOUND**. The only image input is Service.imageUrl, optional nullable trimmed text <=2048; it accepts non-URL strings. Provider/customer avatar not in schema. Frontend can edit/display an existing image URL using service create/patch, with missing/broken-image handling. There is no backend-supported “upload image” sequence or returned storage URL. Image hosting/public URL source remains UNKNOWN and must not be invented as an existing integration.

## 13. Payment system

1. Customer keeps bookingId from booking detail; booking must be ACCEPTED.
2. POST `/api/v1/payments/initiate/:bookingId`, Bearer, no body. Backend loads own booking total, creates/reuses STRIPE Payment, then Stripe hosted Checkout in payment mode, one line item named service.title, amount = Decimal total ×100 rounded to integer. Currency is global lowercased STRIPE_CURRENCY, default usd. Zero-decimal-currency compatibility is not implemented.
3. Receive `201 S<{paymentUrl,sessionId}>`; navigate to paymentUrl. No Stripe.js/publishable key is required by this hosted-redirect implementation.
4. Stripe returns browser to `${APP_BASE_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}` or `${APP_BASE_URL}/payments/cancel`. APP_BASE_URL defaults to backend localhost origin. Both backend root handlers return JSON; neither confirms/changes payment.
5. Signed server webhook `checkout.session.completed` with payment_status paid finds matching metadata.paymentId + bookingId + transactionId=session.id; checks amount/currency; sets PAID/paidAt and ACCEPTED→CONFIRMED atomically with PAYMENT_SUCCESS audit. Non-paid completed sessions return without mutation. Other valid unrelated Stripe events return `{received:true}`.
6. Frontend return page queries GET `/payments/booking/:bookingId` and refetches booking. It must retain bookingId across redirect in its own state; no endpoint maps session_id to booking and cancellation return URL has no booking ID. Render “confirmation pending” until API reports PAID; stop aggressive retries on error.

Payment states actually written: initial UNPAID record → PENDING after successful session setup → PAID on matched completed webhook. FAILED handler exists but looks up transactionId by PaymentIntent ID while initialization stores Checkout Session ID: normal failure reconciliation is inconsistent. CANCELLED/REFUNDED are enum values only, no route writes them. No refund, verification-by-session-ID, invoice/receipt, provider payout, payment history list or expiry cleanup. Booking list contains payment summary; status API contains more fields but no gatewayResponse.

Retry/concurrency limitations: initiation for existing PENDING payment creates another session and overwrites transactionId, so older session's completed webhook may404. No Stripe idempotency key, current-session reuse, explicit webhook event-ID dedup table or Checkout expiry handling. Paid-state guard is present, but not all concurrent event races are guarded. Cancelling ACCEPTED booking with payment PENDING is allowed; previously created Checkout may still collect payment, then webhook cannot confirm CANCELLED booking (409). Frontend must not claim cancellation also cancelled the payment session/refunded funds.

Evidence: `Payment/payment.service.ts::{initiatePayment,getPaymentStatus,finalizeCheckout,markPaymentFailed}`, `Payment/payment.controller.ts::webhook`, `Payment/stripe.service.ts`, `src/app.ts`.

## 14. Location, map and realtime

Provider city/address and Service.serviceArea are strings. Service city filter uses provider.city case-insensitive equality; there are no latitude/longitude, radius, distance, address-book or live-tracking fields/APIs. Map provider/key NOT FOUND. No WebSocket URL, event namespace, emit/listen or payload contract. Booking tracking uses ordinary GET APIs. Stripe webhooks are server-to-server callbacks and are not browser subscriptions.

Frontend-derived handling: refresh relevant GET data after mutation, on return from Checkout and when revisiting a job. If periodic polling is chosen, keep it bounded/backed off because all normal requests share 100 requests/15min/IP; a fast multi-panel polling loop will exceed this. No server polling interval recommendation or SSE alternative is implemented.

## 15. Search, filter, sort and pagination

§3.4 defines every accepted query, data type/default/sort field and matching rule. §3.5 maps each listing endpoint to it. Lists use offset `(page-1)*limit`; no cursors, stable tie-breaker IDs, faceting, category counts or full-text relevance ordering. Sorting is one field only. Empty arrays are successful responses, not errors; pages beyond totalPages remain empty with the requested page value.

Public provider browsing is service discovery + provider detail; GET `/providers` does not exist. Admin provider listing cannot power a public provider directory. Public categories return an unpaginated array and ignore search. Provider slots default limit20; bookings/reviews/services/admin users/providers/categories default10; audit default20; recent activity is a limited array default20.

Public slots default future filtering but supplied past from bypasses the future cutoff; booking still rejects start<=now. From/to validation permits equal boundaries although slot errors say “later than”. Admin metrics/audit dates use coercion rather than strict ISO validator, but frontend contract should send unambiguous timezone-bearing ISO strings.

## 16. Notification system

In-app notifications, read/unread state, push subscription, SMS, backend email templates/sending and realtime notifications: NOT FOUND in schema, routes, imports or dependencies. No notification event payload exists. Successful writes often create AuditLog in the same transaction; this is only exposed through ADMIN audit/recent-activity APIs.

Actual audit actions: PROVIDER_PROFILE_UPDATED; USER_STATUS_CHANGED; USER_SOFT_DELETED; PROVIDER_STATUS_CHANGED; CATEGORY_CREATED/CATEGORY_UPDATED/CATEGORY_SOFT_DELETED; SERVICE_CREATED/SERVICE_UPDATED/SERVICE_SOFT_DELETED; AVAILABILITY_CREATED/AVAILABILITY_UPDATED/AVAILABILITY_DELETED; BOOKING_CREATED/BOOKING_CANCELLED/BOOKING_ACCEPTED/BOOKING_REJECTED/BOOKING_STARTED/BOOKING_COMPLETED; PAYMENT_INITIATED/PAYMENT_SUCCESS/PAYMENT_FAILED; REVIEW_CREATED/REVIEW_UPDATED/REVIEW_DELETED/REVIEW_ADMIN_DELETED. Auth and User own-profile update have no audit calls. PAYMENT_SUCCESS records payment status and bookingId; no separate BOOKING_CONFIRMED audit event.

## 17. Error handling guide

| Actual status | Backend cause | Frontend handling contract |
|---|---|---|
| 400 | Zod validation, invalid date/range, same admin status/self protection, webhook metadata/amount | Show field errors by dotted path; root path can be empty; otherwise display message. Correct request, do not auto-refresh auth |
| 401 | Missing/expired/invalid access, inactive/deleted current user, invalid refresh or credentials | Login errors stay on form. Protected request may refresh once; failed refresh clears session |
| 403 | Role/provider approval, inactive login, self-booking, CORS | Distinguish permission/status; do not infinite-refresh. Browser CORS may hide response body |
| 404 | Missing/foreign/hidden owned resource; missing completed booking | Show unavailable/not found, refetch parent list; do not disclose foreign ownership |
| 409 | Invalid transition, duplicate booking/review/category, occupied slot, paid cancellation | Refetch authoritative entity/slots; no optimistic success |
| 429 | Global express-rate-limit 100/15min/IP | Parse text fallback; honor Retry-After when present; back off |
| 500 | Unknown exception/DB errors/invalid JSON parser errors/uncaught Stripe signature/API errors; JWT missing config may use explicit AppError message | Generic failure; preserve form; avoid duplicate mutation retries |
| 502 | Stripe session has no URL | Payment unavailable, no success claim |
| 503 | Missing Stripe or webhook configuration | Payment integration unavailable |

`AppError` envelope `{success:false,message,errors: details ? [details] : []}`. Zod envelope `{success:false,message:'Validation failed',errors:[{path,message}]}`. Unknown exception envelope `{success:false,message:'Internal server error',errors:[]}`. No error code enum/requestId/stack field. Validation messages come from installed Zod version or inline custom message; do not rely on every English string for control flow.

Unmatched route uses Express default404 (typically HTML `Cannot METHOD /path`), because there is no JSON not-found handler. Rate-limit default response is text; malformed JSON parser errors reach generic500 (handler does not honor parser.status), likewise oversized JSON body errors. The installed express-rate-limit default text is `Too many requests, please try again later.`; no app override. Client adapter must inspect status/content-type and safely fall back for non-JSON/network errors. Network failure has no backend response/status; it does not prove a mutation failed to commit.

All explicit endpoint business errors are listed in §3.5. Raw DB uniqueness errors are mapped only in register/createBooking/createReview; category/service/availability races can surface generic500. Evidence: `src/app.ts`, `src/app/errors/AppError.ts`, module catches.

## 18. Environment and configuration

| Configuration | Code default / frontend relevance |
|---|---|
| Backend origin/API base | PORT5000 → local `http://localhost:5000/api/v1`; production origin UNKNOWN. Frontend variable naming is not established in this empty frontend project |
| CORS_ORIGINS | Dev fallback exactly `http://localhost:3000`; production fallback empty. Comma-separated exact http/https origins only, no wildcard, no trailing slash/path. If frontend uses localhost5173, backend allowlist must include it |
| APP_BASE_URL | default `http://localhost:5000`; Stripe return-page origin. Deployment must choose whether returns land on frontend or backend JSON routes |
| STRIPE_CURRENCY | default `usd`, lowercase; available through payment status endpoint. Public service/booking DTO has no currency field; catalog display currency requires deployment agreement |
| PLATFORM_FEE_PERCENT | default string10; server-only amount calculation. No fee-config/quote endpoint; created booking carries final servicePrice/platformFee/totalAmount |
| JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN | defaults15m/30d; configurable. No frontend secret needed |
| NODE_ENV | production enables Express trust proxy1 and changes CORS fallback |
| Upload/map/socket/public Stripe key | NOT FOUND / not required by current hosted Checkout flow |

DATABASE_URL/DIRECT_URL, JWT secrets, Stripe secrets, BCRYPT_SALT_ROUNDS are backend-only configuration; never expose to browser bundles. Names are documented; values intentionally omitted. No credentials CORS option is enabled and no cookie auth exists. Public environment values shown here are code defaults, not deployed observations. Evidence: `src/config/index.ts`, `src/app.ts`, `README.md`, `.env.example` existence only.

## 19. Frontend page requirements derived from backend

These are frontend composition suggestions grounded in available APIs, not existing frontend screens.

| Audience | Page/screen | Dependency |
|---|---|---|
| Public | Catalog/landing, service list/search | categories + services; marketing copy is not CMS-driven |
| Public | Service detail with slots/reviews | service detail + availability + reviews + summary |
| Public | Provider detail with services/reviews | provider detail + services?provider + reviews/summary |
| Public | Register/login | Auth APIs; role selector only CUSTOMER/PROVIDER |
| Customer | Booking overview/history + detail | bookings/me + bookings/:id; status tabs |
| Customer | Booking creation/confirmation | selected service/slot → POST bookings |
| Customer | Profile | GET/PATCH users/me |
| Customer | Payment return/status | remembered bookingId → GET payment state + booking; initiate button on ACCEPTED |
| Customer | My reviews/edit | reviews/me + create/patch/delete |
| Provider | Profile + approval status | providers/me; pending/rejected explanatory state |
| Provider | Services + editor | providers/me/services + public category options |
| Provider | Availability | own slot list/create/update/delete + own services |
| Provider | Requests/active jobs/history/detail | provider bookings + four action routes |
| Provider | Reviews (read-only) | public provider review/summary with own profileId |
| Admin | Dashboard/analytics | six dashboard endpoints |
| Admin | Users list/detail/moderation | admin users/status/delete |
| Admin | Providers/approval | admin providers/status |
| Admin | Categories/editor | category admin CRUD |
| Admin | Review moderation | admin reviews/delete |
| Admin | Audit list/detail | admin audit logs |

No backend-supported notifications, provider earnings/withdrawals, admin settings/refunds/complaints, customer address book, password recovery, dedicated admin order/payment CRUD screens. Payment information can be embedded in own booking pages; a global payment history page has no backing list API.

## 20. Frontend API service map

The complete per-feature mapping, including method/auth/request/response/status, is §24; it contains all 66 routes without merging HTTP methods. Suggested frontend service boundaries (not existing code):

| Client service | Endpoint group | Purpose |
|---|---|---|
| authApi | E01–E05 | Identity/token lifecycle |
| profileApi | E06–E10 | User/provider self and public profile |
| catalogApi | E11–E17 | Categories/public services/provider services |
| availabilityApi | E18–E22 | Public and own slots |
| bookingApi | E23–E32 | Customer/provider booking lifecycle |
| paymentApi | E33–E34 | Initiate/status; E35 is server-only webhook |
| reviewApi | E36–E43 | Own/public reviews and summaries |
| adminApi | E44–E63 | Analytics/audit/users/providers/categories/moderation |
| operational | E64–E66 | Health/informational root redirects |

Use shared envelope adapter but keep individual DTO types distinct (AuthUser vs UserProfile; CustomerBooking vs ProviderBooking; public vs own Service). Do not import generated Prisma models into browser as if they were response contracts.

## 21. Frontend state requirements

| State | API source | Invalidation/handling |
|---|---|---|
| Auth tokens/refresh in flight | login/refresh | Replace pair together; serialize refresh; clear on logout/failed refresh |
| Current user/role | auth/me or users/me | Re-read after login/profile/status-related401; role is DB-driven |
| Provider approval/profile | providers/me | Gate approval-required actions; do not confuse User.status with ProviderStatus |
| Catalog filters/page/sort | QServices + response.meta | Reset page when filters change; empty success state |
| Service/slot selection | public detail/availability | Invalidate after booking/conflict; IDs authoritative |
| Booking status/amounts | own booking detail/list | Refetch after actions and Checkout; separate payment and booking status |
| Payment redirect context | initiation + remembered bookingId | Persist enough to reconcile return; sessionId alone cannot query backend |
| Pending payment confirmation | payment status | UNPAID minimal union vs persisted Payment; bounded refresh |
| Own services/availability | provider lists | Refetch affected lists after mutation; cancelled slot flag is not reuse guarantee |
| Reviews/summary | reviews/me + public summaries | Invalidate after create/update/delete; stored profile rating can be stale |
| Admin filters/metrics/audit | admin query/response DTOs | No fabricated global counts from paginated data |
| Loading/empty/error/mutation pending | actual HTTP lifecycle | Disable duplicate action clicks; preserve input; tolerate text errors |

Notification state, provider live-location state, withdrawal balance and online availability toggle have no backing contract. A local navigation UI state is fine, but must not imply persistent backend data.

## 22. Important edge cases supported by code

1. Concurrent customers claim a slot: conditional update and unique slotId yield409 for loser. Refresh slots instead of resubmitting repeatedly.
2. Cancel/reject flips isBooked false but keeps unique Booking.slotId: slot may reappear in public list yet rebooking fails409. Deleting it can fail FK500; editing it may change the historical booking's referenced slot. This is a verified source-level contradiction, not a promised reusable slot.
3. Cancel/reject success may contain stale `slot.isBooked:true` because response was selected before release. Refetch detail/slots.
4. Booking create/accept/payment/action states may race; status validation happens before unguarded update. Refetch after conflicts; frontend cannot guarantee integrity under concurrency.
5. Changing service price after booking does not change snapshot price; service title/image/duration/provider phone and slot relation remain live, so historical presentation can change.
6. Service delete/deactivate or provider moderation hides discovery, but historical booking references remain. Provider no longer APPROVED cannot read/action jobs until status restored.
7. Public reviews/summaries ignore parent/customer visibility; provider profile/services can404 while reviews still200.
8. Review soft-delete prevents a second review for that booking because unique bookingId remains. Frontend cannot determine a deleted own review from reviews/me; attempting replacement may409.
9. ProviderProfile.rating/totalReviews never updated by review mutations; rating-summary is authoritative live aggregate and can disagree with provider sorting/cards.
10. Repeated Checkout starts replace transactionId; cancellation does not expire Checkout; failure events may not match saved ID. Pending status can remain indefinitely because no expiry job.
11. Admin same-status mutation returns400; self suspend/block/delete prohibited. Other admin accounts have no “last admin” guard.
12. Strict body extra keys cause400, e.g. adding totalAmount or customer address to booking. Null fails unless explicitly allowed. Price string0/minPrice0 rejected; numeric price can exceed two decimals and DB rounding/overflow differs from validator.
13. Slug generation only retains ASCII letters/digits; Bengali-only category name can produce empty generated slug (not revalidated), and deleted category/service slugs still reserve uniqueness. Details use id, not slug.
14. Public future availability can be overridden with past from; booking then409. Slot duration need not equal service.duration, and overlapping slot creates can race because there is no exclusion constraint.
15. All clients behind one IP share rate limit, including health/login/status. Postman may work while browser fails CORS; production empty allowlist denies browser origins.
16. No Payment record is represented differently from a persisted UNPAID Payment. Do not access payment.id/amount without checking shape.
17. Root success redirect is not proof of payment. Reloaded return page without retained bookingId has no session lookup fallback.
18. Network failure after write may mean write committed. Booking/review duplicate retries409; payment retry may create a second session. Read current state before retrying a mutation.

Evidence: cited module implementations/schema; operational occurrences remain untested in this analysis.

## 23. Security requirements for frontend integration

Backend expects Bearer JWT, current active user, route role, ownership and provider approval where coded. Frontend route guards mirror those rules for usability; server still makes the decision. Handle role403/identity401 distinctly. No cookie CSRF flow exists; do not add cookie assumptions. Browser origin must be explicitly allowed by backend CORS. No client permission-grant management is supported.

Keep password/token values out of debug logs, URLs and shared caches; clear account-scoped cache on identity switch. Password is write-only and never in selected user DTOs. Display only returned public/private fields in their intended audience; provider has customer phone, admin has email/phone/IP/user-agent, public APIs do not expose those private user fields. Audit snapshot keys are redacted server-side but free-text values remain arbitrary user/admin data; render as text, not trusted HTML. imageUrl is plain unvalidated text, so frontend should restrict rendering to acceptable image URL schemes as a frontend handling choice, not claim server upload validation.

Helmet and global rate limit exist; login has no separate limiter/account lockout. No file restrictions because no upload endpoint. Gateway secrets/signature verification remain on server; frontend only follows returned Checkout URL and reads status. Do not let client amounts control payment. Do not expose DB/generated authentication models or server environment secrets in frontend. No special CORS exposed-header list is configured, so do not assume RateLimit headers are browser-readable cross-origin.

## 24. API dependency matrix

Request and response shorthand expands in §3; each API's detailed business behavior/errors/evidence is in its E record. Status means source implementation + success HTTP status, not deployment certification.

| Feature | Frontend Page | API | Method | Auth | Role | Request | Response | Status |
|---|---|---|---|---|---|---|---|---|

| E01 Registration | Register | `/api/v1/auth/register` | POST | No | Public | body:Register; query:none | `AuthUser` | IMPLEMENTED 201 |

| E02 Login | Login | `/api/v1/auth/login` | POST | No | Public | body:Login; query:none | `TokenPair` | IMPLEMENTED 200 |

| E03 Refresh session | Session adapter | `/api/v1/auth/refresh-token` | POST | No | Public | body:TokenBody; query:none | `TokenPair` | IMPLEMENTED 200 |

| E04 Logout | Account menu | `/api/v1/auth/logout` | POST | No | Public | body:TokenBody; query:none | `null` | IMPLEMENTED 200 |

| E05 Current identity | Session adapter | `/api/v1/auth/me` | GET | Bearer | Any | body:none; query:none | `AuthUser` | IMPLEMENTED 200 |

| E06 Own profile | Profile | `/api/v1/users/me` | GET | Bearer | Any | body:none; query:none | `UserProfile` | IMPLEMENTED 200 |

| E07 Edit user profile | Profile | `/api/v1/users/me` | PATCH | Bearer | Any | body:PatchUser; query:none | `UserProfile` | IMPLEMENTED 200 |

| E08 Provider profile | Provider profile | `/api/v1/providers/me` | GET | Bearer | PROVIDER | body:none; query:none | `ProviderSelf` | IMPLEMENTED 200 |

| E09 Edit provider profile | Provider profile | `/api/v1/providers/me` | PATCH | Bearer | PROVIDER | body:PatchProvider; query:none | `ProviderSelf` | IMPLEMENTED 200 |

| E10 Public provider | Provider details | `/api/v1/providers/:id` | GET | No | Public | body:none; query:none | `ProviderPublic` | IMPLEMENTED 200 |

| E11 Browse categories | Catalog | `/api/v1/categories` | GET | No | Public | body:none; query:none | `Category[]` | IMPLEMENTED 200 |

| E12 Discover services | Services | `/api/v1/services` | GET | No | Public | body:none; query:QServices | `Page<PublicService>` | IMPLEMENTED 200 |

| E13 Service details | Service details | `/api/v1/services/:id` | GET | No | Public | body:none; query:none | `PublicService` | IMPLEMENTED 200 |

| E14 Own services | Provider services | `/api/v1/providers/me/services` | GET | Bearer | PROVIDER | body:none; query:QOwnServices | `Page<OwnService>` | IMPLEMENTED 200 |

| E15 Create service | Provider service form | `/api/v1/providers/me/services` | POST | Bearer | PROVIDER | body:CreateService; query:none | `OwnService` | IMPLEMENTED 201 |

| E16 Edit service | Provider service form | `/api/v1/providers/me/services/:id` | PATCH | Bearer | PROVIDER | body:PatchService; query:none | `OwnService` | IMPLEMENTED 200 |

| E17 Delete service | Provider services | `/api/v1/providers/me/services/:id` | DELETE | Bearer | PROVIDER | body:none; query:none | `null` | IMPLEMENTED 200 |

| E18 Available slots | Service details / Booking | `/api/v1/services/:serviceId/availability` | GET | No | Public | body:none; query:QPublicSlots | `Page<PublicSlot>` | IMPLEMENTED 200 |

| E19 Own slots | Provider availability | `/api/v1/providers/me/availability` | GET | Bearer | PROVIDER | body:none; query:QOwnSlots | `Page<OwnSlot>` | IMPLEMENTED 200 |

| E20 Create slot | Provider availability | `/api/v1/providers/me/availability` | POST | Bearer | PROVIDER | body:CreateSlot; query:none | `OwnSlot` | IMPLEMENTED 201 |

| E21 Edit slot | Provider availability | `/api/v1/providers/me/availability/:id` | PATCH | Bearer | PROVIDER | body:PatchSlot; query:none | `OwnSlot` | IMPLEMENTED 200 |

| E22 Delete slot | Provider availability | `/api/v1/providers/me/availability/:id` | DELETE | Bearer | PROVIDER | body:none; query:none | `null` | IMPLEMENTED 200 |

| E23 Create booking | Booking | `/api/v1/bookings` | POST | Bearer | CUSTOMER | body:CreateBooking; query:none | `CustomerBooking` | IMPLEMENTED 201 |

| E24 Booking history | Customer bookings | `/api/v1/bookings/me` | GET | Bearer | CUSTOMER | body:none; query:QBookings | `Page<CustomerBooking>` | IMPLEMENTED 200 |

| E25 Booking detail | Customer booking detail | `/api/v1/bookings/:id` | GET | Bearer | CUSTOMER | body:none; query:none | `CustomerBooking` | IMPLEMENTED 200 |

| E26 Cancel booking | Customer booking detail | `/api/v1/bookings/:id/cancel` | PATCH | Bearer | CUSTOMER | body:none; query:none | `CustomerBooking` | IMPLEMENTED 200 |

| E27 Incoming/active/history jobs | Provider jobs | `/api/v1/providers/me/bookings` | GET | Bearer | PROVIDER | body:none; query:QBookings | `Page<ProviderBooking>` | IMPLEMENTED 200 |

| E28 Job detail | Provider job detail | `/api/v1/providers/me/bookings/:id` | GET | Bearer | PROVIDER | body:none; query:none | `ProviderBooking` | IMPLEMENTED 200 |

| E29 Accept job | Provider job detail | `/api/v1/providers/me/bookings/:id/accept` | PATCH | Bearer | PROVIDER | body:none; query:none | `ProviderBooking` | IMPLEMENTED 200 |

| E30 Reject job | Provider job detail | `/api/v1/providers/me/bookings/:id/reject` | PATCH | Bearer | PROVIDER | body:none; query:none | `ProviderBooking` | IMPLEMENTED 200 |

| E31 Start job | Provider job detail | `/api/v1/providers/me/bookings/:id/start` | PATCH | Bearer | PROVIDER | body:none; query:none | `ProviderBooking` | IMPLEMENTED 200 |

| E32 Complete job | Provider job detail | `/api/v1/providers/me/bookings/:id/complete` | PATCH | Bearer | PROVIDER | body:none; query:none | `ProviderBooking` | IMPLEMENTED 200 |

| E33 Start Checkout | Booking payment | `/api/v1/payments/initiate/:bookingId` | POST | Bearer | CUSTOMER | body:none; query:none | `Checkout` | IMPLEMENTED 201 |

| E34 Payment reconciliation | Payment return / Booking detail | `/api/v1/payments/booking/:bookingId` | GET | Bearer | CUSTOMER | body:none; query:none | `PaymentState` | IMPLEMENTED 200 |

| E35 Gateway event | Server only | `/api/v1/payments/stripe/webhook` | POST | Signature | Stripe signature | body:Raw Stripe event; query:none | `{received:true}` | IMPLEMENTED 200 |

| E36 Write review | Completed booking / Reviews | `/api/v1/reviews` | POST | Bearer | CUSTOMER | body:CreateReview; query:none | `OwnReview` | IMPLEMENTED 201 |

| E37 Own reviews | Customer reviews | `/api/v1/reviews/me` | GET | Bearer | CUSTOMER | body:none; query:QReviews | `Page<OwnReview>` | IMPLEMENTED 200 |

| E38 Edit review | Customer reviews | `/api/v1/reviews/:id` | PATCH | Bearer | CUSTOMER | body:PatchReview; query:none | `OwnReview` | IMPLEMENTED 200 |

| E39 Delete review | Customer reviews | `/api/v1/reviews/:id` | DELETE | Bearer | CUSTOMER | body:none; query:none | `null` | IMPLEMENTED 200 |

| E40 Public services reviews | Service / Provider details | `/api/v1/services/:serviceId/reviews` | GET | No | Public | body:none; query:QReviews | `Page<PublicReview>` | IMPLEMENTED 200 |

| E41 Live services rating | Service / Provider details | `/api/v1/services/:serviceId/rating-summary` | GET | No | Public | body:none; query:none | `RatingSummary` | IMPLEMENTED 200 |

| E42 Public providers reviews | Service / Provider details | `/api/v1/providers/:providerId/reviews` | GET | No | Public | body:none; query:QReviews | `Page<PublicReview>` | IMPLEMENTED 200 |

| E43 Live providers rating | Service / Provider details | `/api/v1/providers/:providerId/rating-summary` | GET | No | Public | body:none; query:none | `RatingSummary` | IMPLEMENTED 200 |

| E44 Marketplace counts | Admin dashboard | `/api/v1/admin/dashboard/overview` | GET | Bearer | ADMIN | body:none; query:none | `Overview` | IMPLEMENTED 200 |

| E45 Revenue totals | Admin dashboard | `/api/v1/admin/dashboard/revenue` | GET | Bearer | ADMIN | body:none; query:QRevenue | `Revenue` | IMPLEMENTED 200 |

| E46 Booking analytics | Admin dashboard | `/api/v1/admin/dashboard/bookings` | GET | Bearer | ADMIN | body:none; query:QBookingMetrics | `BookingMetrics` | IMPLEMENTED 200 |

| E47 Provider analytics | Admin dashboard | `/api/v1/admin/dashboard/providers` | GET | Bearer | ADMIN | body:none; query:none | `ProviderMetrics` | IMPLEMENTED 200 |

| E48 Service analytics | Admin dashboard | `/api/v1/admin/dashboard/services` | GET | Bearer | ADMIN | body:none; query:none | `ServiceMetrics` | IMPLEMENTED 200 |

| E49 Recent audit activity | Admin dashboard | `/api/v1/admin/dashboard/recent-activity` | GET | Bearer | ADMIN | body:none; query:QActivity | `Activity[]` | IMPLEMENTED 200 |

| E50 Audit list | Admin audit | `/api/v1/admin/audit-logs` | GET | Bearer | ADMIN | body:none; query:QAudit | `Page<Audit>` | IMPLEMENTED 200 |

| E51 Audit detail | Admin audit detail | `/api/v1/admin/audit-logs/:id` | GET | Bearer | ADMIN | body:none; query:none | `Audit` | IMPLEMENTED 200 |

| E52 User management list | Admin users | `/api/v1/admin/users` | GET | Bearer | ADMIN | body:none; query:QUsers | `Page<AdminUser>` | IMPLEMENTED 200 |

| E53 User detail | Admin user detail | `/api/v1/admin/users/:id` | GET | Bearer | ADMIN | body:none; query:none | `AdminUser` | IMPLEMENTED 200 |

| E54 User moderation | Admin users | `/api/v1/admin/users/:id/status` | PATCH | Bearer | ADMIN | body:UserStatusBody; query:none | `AdminUser` | IMPLEMENTED 200 |

| E55 Delete user | Admin users | `/api/v1/admin/users/:id` | DELETE | Bearer | ADMIN | body:none; query:none | `null` | IMPLEMENTED 200 |

| E56 Provider moderation list | Admin providers | `/api/v1/admin/providers` | GET | Bearer | ADMIN | body:none; query:QProviders | `Page<AdminProvider>` | IMPLEMENTED 200 |

| E57 Provider approval/rejection | Admin providers | `/api/v1/admin/providers/:id/status` | PATCH | Bearer | ADMIN | body:ProviderStatusBody; query:none | `AdminProvider` | IMPLEMENTED 200 |

| E58 Category management list | Admin categories | `/api/v1/admin/categories` | GET | Bearer | ADMIN | body:none; query:QCategories | `Page<Category>` | IMPLEMENTED 200 |

| E59 Create category | Admin category form | `/api/v1/admin/categories` | POST | Bearer | ADMIN | body:CreateCategory; query:none | `Category` | IMPLEMENTED 201 |

| E60 Edit category | Admin category form | `/api/v1/admin/categories/:id` | PATCH | Bearer | ADMIN | body:PatchCategory; query:none | `Category` | IMPLEMENTED 200 |

| E61 Delete category | Admin categories | `/api/v1/admin/categories/:id` | DELETE | Bearer | ADMIN | body:none; query:none | `null` | IMPLEMENTED 200 |

| E62 Review moderation list | Admin reviews | `/api/v1/admin/reviews` | GET | Bearer | ADMIN | body:none; query:QAdminReviews | `Page<AdminReview>` | IMPLEMENTED 200 |

| E63 Moderate review | Admin reviews | `/api/v1/admin/reviews/:id` | DELETE | Bearer | ADMIN | body:none; query:none | `null` | IMPLEMENTED 200 |

| E64 Health | Operational probe | `/health` | GET | No | Public | body:none; query:none | `null` | IMPLEMENTED 200 |

| E65 Checkout success redirect | Payment return | `/payments/success` | GET | No | Public | body:none; query:ignored session_id | `null` | IMPLEMENTED 200 |

| E66 Checkout cancel redirect | Payment return | `/payments/cancel` | GET | No | Public | body:none; query:none | `null` | IMPLEMENTED 200 |

## 25. Backend to frontend implementation checklist

এই checklist integration acceptance-এর জন্য; নিচের কাজগুলো এই analysis-এ runtime-executed নয়। অনুপস্থিত feature-কে required implementation হিসেবে ধরা হয়নি।

- [ ] Actual API origin, CORS frontend origin, currency এবং APP_BASE_URL নিশ্চিত করা।
- [ ] CUSTOMER/PROVIDER registration, login, me, serialized refresh এবং logout integration।
- [ ] Role/approval guards ও inactive-user401/403 behavior।
- [ ] User/provider profile DTO আলাদা; phone fields independent।
- [ ] Public category/service/provider views, exact filters/sorts/pagination।
- [ ] Provider service CRUD; category dependencies/nullable text/image URL handling।
- [ ] Provider availability CRUD, timezone offset, overlap/booked-slot conflict।
- [ ] Customer booking creation, server amounts, ownership/history/detail।
- [ ] Provider accept/reject/start/complete; exact state machine।
- [ ] Cancellation constraints + slot reuse contradiction explicitly resolved/accepted before production flow relies on it।
- [ ] Hosted Checkout redirect context, pending confirmation, authoritative status read।
- [ ] Payment retry/failure/cancel-vs-webhook risks verified with backend owner।
- [ ] Completed-booking reviews, update/delete, duplicate and soft-delete limitations।
- [ ] Live rating summaries; stored provider rating inconsistency accounted for।
- [ ] Admin users/providers/categories/reviews, six analytics APIs, audit pages।
- [ ] JSON/text/HTML/network error adapter, 400/401/403/404/409/429/500/502/503 behavior।
- [ ] Loading/empty/no-result/pending mutation states; invalidation after writes।
- [ ] Deployed end-to-end and concurrent booking/payment behavior verified separately।

Not required because NOT FOUND: actual file upload, realtime, notification inbox, refunds/disputes, rescheduling, maps/tracking, provider withdrawals, password reset/OTP, custom permissions, admin booking/payment CRUD.

## 26. FRONTEND IMPLEMENTATION CONTRACT

1. **Supported product:** three-role service marketplace with provider-owned services, explicit availability, customer bookings, provider job lifecycle, Stripe Checkout, customer reviews, admin moderation/reporting/audit. Use §24's exact route map; do not use conceptual `/orders`, `/workers`, `/notifications` paths.
2. **Auth:** POST login → read TokenPair → Bearer GET me → use database-returned role. Public register requires explicit CUSTOMER/PROVIDER. Refresh/logout receive refreshToken JSON body. No cookies, password recovery or ADMIN signup contract.
3. **Roles:** CUSTOMER owns bookings/payments/reviews; PROVIDER owns service/slot/jobs and selected mutations require APPROVED; ADMIN has only actual `/admin/*` capabilities plus own profile/public endpoints. No admin superuser bypass on provider/customer routes.
4. **Discovery:** GET categories + services with QServices; detail by id; provider profile id from service.provider.id. Service record already determines provider. Slot list selects schedule; no arbitrary scheduling payload or address object.
5. **Business sequence:** booking PENDING → provider ACCEPTED → signed Stripe success CONFIRMED → provider IN_PROGRESS → COMPLETED → customer review. REJECTED/CANCELLED terminal; no reopen/reschedule. Paid cancellation blocked.
6. **Money/payment:** show persisted booking price/fee/total decimal strings. Only accepted own booking can initiate payment. Redirect to data.paymentUrl; retain bookingId; read PaymentState after return. No publishable key/Stripe.js necessary for current redirect integration; no client webhook calls. UNPAID may be a minimal object. Currency must be agreed from backend deployment/status API.
7. **Data:** consume S<T>, Page<T>, exact nullable/nested DTOs in §3.2. Do not equate whole Prisma models to API responses or assume success.data is always array. ISO offset dates in slot requests, ISO strings in responses. Aggregated ratings numbers vs profile Decimal strings.
8. **Status/errors:** render independent BookingStatus and PaymentStatus; validate action availability but refetch after every mutation/conflict. Handle401 refresh,403 permission/approval,404 unavailable,409 conflicts,400 validation,429 backoff and non-JSON fallback. Deletion200/null. No hardcoded422 expectation.
9. **Realtime/external:** no browser event system, maps, notification service or upload storage. Use request/refetch and cautious optional polling. External frontend interaction is hosted Checkout and externally supplied service image URLs.
10. **Known blockers:** released-slot unique/FK conflict, Checkout failure/retry/race limitations, stale stored provider ratings, review soft-delete uniqueness, missing session→booking lookup, no currency/fee discovery before booking. Frontend cannot silently repair these backend semantics.
11. **Do not invent:** customer address storage, provider earnings/withdrawals, refunds, file upload, customer/provider notification center, admin order/payment mutation, availability recurrence, staff assignment, email verification or password reset. UNKNOWN deployment decisions must be explicit before production launch.

## 27. UNKNOWN / NEEDS VERIFICATION

| Finding | Evidence | Integration impact / classification |
|---|---|---|
| Production API URL, origin allowlist, APP_BASE_URL, actual currency/fee/expiry | config defaults only; no live deployment inspected | UNKNOWN; confirm public config without exposing secrets |
| Live DB/schema/migration consistency, Stripe connectivity, seeded records | source/migration read only | NEEDS VERIFICATION; no DB writes or live payment made |
| Slot release contradicts unique booking lifetime | Booking.slotId unique; cancel/reject retain row and set isBooked false | Confirmed source gap: rebook409; slot deletion can500; slot edits affect history |
| Failure callback ID mismatch | initiate stores session.id; markPaymentFailed searches PaymentIntent.id | Confirmed source gap; FAILED may never reflect normal failed Checkout |
| Multiple Checkout sessions/old webhook mapping | initiate overwrites transactionId without idempotency | Confirmed source gap; old paid session may404; recovery behavior UNKNOWN |
| Cancellation with pending payment | cancel only blocks PAID; session not expired; finalize rejects CANCELLED | Confirmed source gap; money can be collected without booking confirmation |
| Transition/availability races | pre-read state then update by ID; overlap check lacks exclusion constraint | Integrity NEEDS VERIFICATION under concurrency; UI cannot enforce it |
| Stored provider rating never maintained | Review services only insert/update/delete Review; profile rating default0 | Confirmed source gap; use rating-summary for live display, sorting still stored rating |
| Review deletion retains unique bookingId | schema unique + softDeleteReview | Confirmed source gap; deleted own review cannot be recreated or restored |
| JWT rotation token uniqueness | identical claims, no jti, second timestamps; tokenHash not unique | Distinct-token/replay assumptions NEEDS VERIFICATION |
| Catalog currency/fee quote before booking | no public config/quote endpoint; service lacks currency | Frontend needs deployment-level currency agreement; final fee shown after booking |
| Return URL contains session but no booking | success session_id ignored; no lookup API | Frontend must persist bookingId; recovery without context UNKNOWN |
| Admin provisioning | seed only creates categories; register excludes ADMIN | Operational creation flow NOT FOUND |
| `duration` unit and scheduling policy | integer<=1440, no unit field or length rule | Unit/business convention NEEDS VERIFICATION; do not claim enforced minutes matching slot |
| Public provider count vs visibility | `_count.services:true` no filters | Count includes deleted/inactive listings; do not promise public visible service count |
| Public reviews parent visibility | reviews only check Review.deletedAt | Reviews can remain visible for deleted/hidden parents; accepted policy UNKNOWN |
| No upload/notification/realtime/refund/withdrawal/reset/map API | complete routes/schema/dependencies search | NOT FOUND; omit functioning flows |
| App error envelope exceptions | no not-found handler; default limiter; generic parser/Stripe error catch | Handle text/HTML/500, do not trust docs' universal JSON claim |
| Validation vs DB precision/generated slug | number price unbounded precision, generated slug not revalidated | Runtime edge behavior may500/round; frontend must follow known constraints |
| Automated test evidence | tests only .gitkeep; no test npm script | Runtime quality assertion not established by this report |

### Documentation versus implementation cross-check

- `API_SPEC.md` claims66 registered endpoints/63 excluding health+redirects: source route count agrees. The63 includes server-only Stripe webhook; browser API count is62.
- Postman has73 request examples: repeated register/login/search variants, not73 distinct endpoints. Normalized method/path coverage matches66 routes (verified during report QA); body keys inspected agree with validators. Collection execution was not performed.
- `API_SPEC.md` calls public availability “future”; explicit from can request past slots. Booking creation still rejects past starts.
- `API_SPEC.md` says client totals are ignored; strict createBooking body actually rejects unknown total fields. Omit them.
- Documentation suggests consistent error JSON; unknown404 and429 are exceptions, malformed JSON becomes500 in current handler.
- `API_SPEC.md` says critical review runtime verification deferred, yet coverage matrix says end-to-end QA PASS; README says final QA complete. These are inconsistent assertions; no test report/committed suite verified them here.
- `PROJECT_SPEC.md` describes24 seed services and generic Category→Service→Provider concept; actual seed only upserts six categories and retains24 names as unused future definitions. Actual Service belongs to exactly one ProviderProfile.
- `DATABASE_SPEC.md` broadly says soft-deleted records should be excluded; implementation intentionally includes deleted reviews in admin moderation and does not gate public reviews by parent visibility.
- `README.md` references an Express/qs advisory and external security/performance audit. Current advisory applicability and that audit's evidence were not investigated; this report makes no current vulnerability claim.
- README `.env.example` setup path exists; secret values were not copied. Postman environment keys omit some variables referenced in requests, notably providerProfileId/customerId; inspect scripts/manual setup when running collection, do not mistake placeholders for provisioned users.

### Validation performed for this report

Static inspection and route/DTO/schema/documentation cross-check; TypeScript `./node_modules/.bin/tsc --noEmit` **PASS** (exit 0)। Source থেকে extracted66 route এবং report-এর66 endpoint contract exact method/path match; Postman-এর73 examples normalize করে66 route, missing/extra0; সব source hyperlink target exists;27 requested sections ও10 model field tables উপস্থিত। No frontend code, backend logic, migration, seed, dependency update, live Stripe mutation or production request was performed. This is an implementation specification with explicit runtime unknowns, not a production-readiness certification.

# FINAL SUMMARY

Servexa is a TypeScript/Express API using PostgreSQL/Prisma, JWT Bearer auth with database-backed refresh tokens, three roles (CUSTOMER/PROVIDER/ADMIN), Stripe hosted Checkout and transactional audit logs. Ten models cover users, provider profiles, categories, provider-owned services, slots, bookings, payments, reviews, refresh tokens and audit records.

The supported journey is service discovery → reserve slot/PENDING → provider accept → Stripe webhook/CONFIRMED → provider start/complete → customer review. There are66 registered endpoints across auth, profiles, catalog, availability, bookings, payment, reviews, admin analytics/moderation/audit and operational callbacks. The frontend needs catalog/auth/detail screens, customer profile/bookings/payment/reviews, provider profile/services/availability/jobs, and admin dashboard/users/providers/categories/reviews/audit.

Critical dependencies are correct CORS/API/return origins, active roles/approval, persistent bookingId during Checkout, exact DTO/envelope handling, server-calculated money, explicit slot IDs and authoritative webhook-backed payment status. Critical unknowns are deployed configuration, live DB/payment QA, admin provisioning and duration/currency conventions. Critical implementation risks are released-slot unique constraints, pending-payment cancellation and Checkout retry/failure reconciliation, concurrency, stale provider ratings and review soft-delete uniqueness. Uploads, realtime, notifications, refunds, withdrawals, maps and password recovery are absent and must not be invented.
