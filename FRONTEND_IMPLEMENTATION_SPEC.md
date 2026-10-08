> Historical slot-based implementation snapshot. The service-order contract in [API_SPEC.md](API_SPEC.md#service-order-contract-october-2026) supersedes booking/availability workflows below: POST /bookings accepts serviceId and optional notes; slot UI and response fields are removed.

# Servexa Frontend Implementation Specification

**সংক্ষিপ্ত সারাংশ:** Actual backend-এর 66 registered route, Postman-এর 73 request example (66 unique route), দুইটি Postman JSON এবং পাওয়া `../stripe-verify.ts` cross-check করা হয়েছে। Backend primary source of truth। Postman method/path coverage সম্পূর্ণ মেলে; saved responses/run results নেই, আর utility মূলত Checkout initiation/status/ownership পর্যবেক্ষণ করে—সম্পূর্ণ payment completion নয়। Backend code ও Postman পরিবর্তন করা হয়নি; frontend-ও তৈরি করা হয়নি।

Frontend-এ বাস্তবে customer/provider/admin marketplace, catalog, fixed-slot booking, provider accept/start/complete, hosted Stripe Checkout, reviews এবং admin moderation/analytics/audit implement করা সম্ভব। প্রধান integration caveat: released-slot rebooking constraint, Checkout failure/retry/cancellation reconciliation, stale provider ratings, token/ID variable scope, এবং verification utility-এর import path। অনুপস্থিত backend feature-কে frontend capability হিসেবে দাবি করা যাবে না।

**পাঠের নিয়ম:** এই self-contained report আগের রিপোর্ট ছাড়াই implementation planning-এ ব্যবহার করা যাবে। §2-এ প্রতিটি Postman example, §3-এ সব exact backend contract/DTO/validator, §4-এ cross-check, §5-এ utility analysis, §11-এ page requirements, §12-এ API→UI map এবং §24-এ চূড়ান্ত contract আছে। API identifiers E01–E66, Postman identifiers P01–P73। Body/query/response aliases-এর পূর্ণ সংজ্ঞা §3-তে।

**Evidence boundaries:** বিশ্লেষণ ৫ অক্টোবর ২০২৬, Asia/Dhaka; deployment/API/Stripe runtime পুনরায় চালানো হয়নি। ব্যবহারকারীর backend-tested তথ্য স্বীকার করা হচ্ছে; তবে কোন behavior এই নির্দিষ্ট repository artifacts-এ asserted/logged/documented, তা আলাদা করে লেখা হয়েছে। `IMPLEMENTED` ≠ this-session live test pass; `DERIVED` = source থেকে expected result; `PROPOSED` = frontend architecture choice; `NOT FOUND` = inspected files-এ নেই। Secret/private values report করা হয়নি।

**Path convention:** এই ফাইল `servexa-backend/`-এ। `src/...`, `prisma/...`, `postman/...` paths backend-relative; `../stripe-verify.ts` এবং `../servexa-frontend/` Assignment6-root siblings। `Module/foo.service.ts` shorthand expands to `src/app/modules/Module/foo.service.ts`।

## 1. Project structure


Workspace root: `/Users/roxy/Devlopment/PH-2-7/Assignment/Assignment6`। Backend root: `servexa-backend/`। Frontend folder `servexa-frontend/` **empty**, no package.json/framework/routing/UI requirements established there. Exact `Verify.ts`/`verify.ts` file **NOT FOUND** in working project or non-generated archive entries. Actual verification-like file: root `stripe-verify.ts` (43 lines), fully inspected; treated as the available verification source, not silently renamed.

```text
Assignment6/
├── servexa-backend/                 backend application repository
│   ├── src/app.ts, server.ts       HTTP middleware/root routes/listener
│   ├── src/app/routes/index.ts     /api/v1 module mounts
│   ├── src/app/modules/            44 handwritten module files
│   │   ├── Auth/ User/ Provider/ Admin/
│   │   ├── Category/ Service/ Availability/ Booking/
│   │   └── Payment/ Review/
│   ├── src/app/middlewares/auth.ts
│   ├── src/app/errors/AppError.ts
│   ├── src/config/ src/helpers/ src/lib/ src/shared/ src/utils/ src/types/
│   ├── src/generated/prisma/      generated client/models/enums, not HTTP DTOs
│   ├── prisma/schema.prisma       10 models and 7 enums
│   ├── prisma/migrations/20260902165318_init/migration.sql
│   ├── prisma/seed.ts              six category upserts; no admin/provider service seeds
│   ├── postman/Servexa.postman_collection.json
│   ├── postman/Servexa.local.postman_environment.json
│   ├── postman/.gitkeep
│   ├── tests/.gitkeep              no committed automated integration suite
│   ├── package.json, package-lock.json, tsconfig.json, prisma.config.ts
│   ├── eslint.config.js, .prettierrc.json, .prettierignore, .gitignore
│   ├── .env, .env.example          configuration files; private values not published
│   ├── README.md, API_SPEC.md, DATABASE_SPEC.md
│   ├── PROJECT_SPEC.md, ARCHITECTURE.md, DEVELOPMENT_RULES.md
│   └── FRONTEND_INTEGRATION_SPEC.md previous analysis; this report expands three-source audit
├── servexa-frontend/               empty
├── stripe-verify.ts                standalone DB/Stripe verification utility
├── servexa-backend.zip             archived backend; not active source of truth
└── .DS_Store                      OS metadata, no application purpose
```

Dependency/build/VCS directories (`node_modules`, `dist` if present, `.git`) are operational artifacts, not additional API modules. Archive Postman collection/environment JSON bytes match working files; they are the same two logical inputs, not extra APIs. `__MACOSX/.../._*.json` entries are AppleDouble metadata, not Postman JSON documents. No additional working Postman JSON was found.

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

### Backend architecture

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

## 2. Postman complete audit


Both JSON documents were parsed completely, including collection/folder/request metadata, variables, headers, raw bodies, scripts, URL/query/path placeholders and response examples. Every request appears separately below.

| File | Contents | Evidence result |
|---|---|---|
| `postman/Servexa.postman_collection.json` | 12 request folders;73 requests;22 collection variables;8 request-level `test` event scripts | All request URLs match real routes; no collection/folder inherited auth, no saved response objects, no `pm.test`/`pm.expect` assertions |
| `postman/Servexa.local.postman_environment.json` |13 enabled variables; baseUrl localhost5000; other values empty | Placeholder environment, not seeded accounts or populated test results |
| Archive copies in `../servexa-backend.zip` | Same two JSON documents | Byte-equal to working files; no alternate request contract |

**Expected versus observed:** all response shapes/statuses below are backend-derived unless labelled script gate. `if (pm.response.code === 200/201)` scripts do not assert success; when status differs they simply skip storing values. No actual saved response payload/status or runner results are included. Thus “tested request” means a provided executable example, not independently proven passing behavior in the supplied export.

**Auth representation:** token-bearing requests use explicit `Authorization` header; there is no request `auth` object/inherited Bearer setting. Body requests set application/json and raw mode. GETs/bodyless actions have no unnecessary Content-Type. Public requests omit Authorization. Webhook example intentionally omits signature/raw body and is marked documentation-only, so sending it manually will400.

### Variable and script audit

| Variable | Collection value classification | Environment | Writer / consumer relevance |
|---|---|---|---|

| `baseUrl` | http://localhost:5000 | defined; baseUrl value | All URLs; exclude /api/v1 from baseUrl because versioned paths already contain it |

| `accessToken` | empty placeholder | defined empty | No script writer; manual/data source required if referenced; not referenced by actual request URL/header/body templates |

| `customerAccessToken` | empty placeholder | defined empty | Login Customer |

| `providerAccessToken` | empty placeholder | defined empty | Login Provider |

| `adminAccessToken` | empty placeholder | defined empty | Login Admin |

| `refreshToken` | empty placeholder | defined empty | Login Customer, Login Provider, Login Admin |

| `customerEmail` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `customerPassword` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `providerEmail` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `providerPassword` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `adminEmail` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `adminPassword` | configured sample value — omitted (credential/account data) | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `customerId` | empty placeholder | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `providerId` | empty placeholder | not defined; collection scope available | No script writer; manual/data source required if referenced; not referenced by actual request URL/header/body templates |

| `providerProfileId` | empty placeholder | not defined; collection scope available | No script writer; manual/data source required if referenced |

| `categoryId` | empty placeholder | defined empty | Admin Create Category |

| `serviceId` | empty placeholder | defined empty | Create Service |

| `slotId` | empty placeholder | defined empty | Create Availability |

| `bookingId` | empty placeholder | defined empty | Create Booking |

| `paymentId` | empty placeholder | defined empty | No script writer; manual/data source required if referenced; not referenced by actual request URL/header/body templates |

| `reviewId` | empty placeholder | defined empty | Create Review |

| `auditLogId` | empty placeholder | defined empty | No script writer; manual/data source required if referenced |

Scripts write collection variables, while the environment declares same-name empty token/resource variables. With the supplied environment selected, narrower environment values can shadow populated collection values. This follows the documented scope order; inspect resolved values before treating401/empty IDs as backend failures. This is a configuration caveat, not a backend route mismatch. [Postman variable scope documentation](https://learning.postman.com/docs/use/send-requests/variables/variables/).

All three login scripts share one `refreshToken` variable: whichever login runs last overwrites it, while each accessToken variable remains role-specific. Refresh Token has no script to store the rotated pair; Logout has no script clearing saved tokens. Register scripts do not capture customerId/providerProfileId; Get My Provider Profile also has no capture script. AuditLogId is not auto-captured. These are frontend requirements to implement explicitly, not conventions to copy.

**Collection ordering is not a single end-to-end journey:** Logout precedes later protected requests; service/slot delete examples precede booking; accept, reject, start, complete examples run consecutively despite incompatible states and missing payment confirmation; booking cancellation precedes payment initiation; user suspension/deletion and review deletion mutate data used elsewhere. A Runner “run all” is not a meaningful successful business flow without controlled fixtures/order. 2030 slot/query examples are fixed examples, not dynamic “today” data.

### Every request

For each P record: source JSON Pointer is exact; backend E contract supplies complete validation and error behaviors in §3. Saved response/status is **NOT FOUND for all73**. Example bodies below retain placeholder references only; collection credential values are omitted. Query values are literal example choices, not defaults.

#### P01 — Health

- **Source:** `postman/Servexa.postman_collection.json#/item/0/item/0`; folder `/00 - Health`.
- **HTTP:** `GET {{baseUrl}}/health`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E64. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/00 - Health` → Operational probe; Operational only — no marketplace page dependency.

**Body:** none.

#### P02 — Register Customer

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/0`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/register`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public → CUSTOMER`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<AuthUser>`; exact fields/messages/errors in E01. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/01 - Auth` → Register; Yes — Registration.

**Body:**

```json
{
  "name": "Test Customer",
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}",
  "phone": "01700000000",
  "role": "CUSTOMER"
}
```

#### P03 — Register Provider

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/1`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/register`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public → PROVIDER`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<AuthUser>`; exact fields/messages/errors in E01. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/01 - Auth` → Register; Yes — Registration.

**Body:**

```json
{
  "name": "Test Provider",
  "email": "{{providerEmail}}",
  "password": "{{providerPassword}}",
  "phone": "01700000001",
  "role": "PROVIDER",
  "businessName": "Example Services",
  "city": "Dhaka",
  "address": "Example address",
  "bio": "Example provider profile"
}
```

#### P04 — Login Customer

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/2`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/login`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public credentials for CUSTOMER`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<TokenPair>`; exact fields/messages/errors in E02. Saved observed response/status: NOT FOUND. Script status gate: 200.
- **Workflow / relevance:** `/01 - Auth` → Login; Yes — Login.

**Body:**

```json
{
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}"
}
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 200) {
  const data = pm.response.json().data;
  pm.collectionVariables.set('customerAccessToken', data.accessToken);
  pm.collectionVariables.set('refreshToken', data.refreshToken);
}
```

#### P05 — Login Provider

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/3`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/login`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public credentials for PROVIDER`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<TokenPair>`; exact fields/messages/errors in E02. Saved observed response/status: NOT FOUND. Script status gate: 200.
- **Workflow / relevance:** `/01 - Auth` → Login; Yes — Login.

**Body:**

```json
{
  "email": "{{providerEmail}}",
  "password": "{{providerPassword}}"
}
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 200) {
  const data = pm.response.json().data;
  pm.collectionVariables.set('providerAccessToken', data.accessToken);
  pm.collectionVariables.set('refreshToken', data.refreshToken);
}
```

#### P06 — Login Admin

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/4`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/login`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public credentials for ADMIN`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<TokenPair>`; exact fields/messages/errors in E02. Saved observed response/status: NOT FOUND. Script status gate: 200.
- **Workflow / relevance:** `/01 - Auth` → Login; Yes — Login.

**Body:**

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 200) {
  const data = pm.response.json().data;
  pm.collectionVariables.set('adminAccessToken', data.accessToken);
  pm.collectionVariables.set('refreshToken', data.refreshToken);
}
```

#### P07 — Refresh Token

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/5`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/refresh-token`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<TokenPair>`; exact fields/messages/errors in E03. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/01 - Auth` → Session adapter; Yes — Refresh session.

**Body:**

```json
{ "refreshToken": "{{refreshToken}}" }
```

#### P08 — Logout

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/6`; folder `/01 - Auth`.
- **HTTP:** `POST {{baseUrl}}/api/v1/auth/logout`.
- **Headers/auth:** `Content-Type: application/json`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E04. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/01 - Auth` → Account menu; Yes — Logout.

**Body:**

```json
{ "refreshToken": "{{refreshToken}}" }
```

#### P09 — Get Current User

- **Source:** `postman/Servexa.postman_collection.json#/item/1/item/7`; folder `/01 - Auth`.
- **HTTP:** `GET {{baseUrl}}/api/v1/auth/me`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `Any`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<AuthUser>`; exact fields/messages/errors in E05. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/01 - Auth` → Session adapter; Yes — Current identity.

**Body:** none.

#### P10 — Get My Profile

- **Source:** `postman/Servexa.postman_collection.json#/item/2/item/0`; folder `/02 - User`.
- **HTTP:** `GET {{baseUrl}}/api/v1/users/me`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `Any`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<UserProfile>`; exact fields/messages/errors in E06. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/02 - User` → Profile; Yes — Own profile.

**Body:** none.

#### P11 — Update My Profile

- **Source:** `postman/Servexa.postman_collection.json#/item/2/item/1`; folder `/02 - User`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/users/me`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `Any`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<UserProfile>`; exact fields/messages/errors in E07. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/02 - User` → Profile; Yes — Edit user profile.

**Body:**

```json
{ "name": "Updated Customer", "phone": "01700000002" }
```

#### P12 — Get My Provider Profile

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/0`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/me`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderSelf>`; exact fields/messages/errors in E08. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider profile; Yes — Provider profile.

**Body:** none.

#### P13 — Update My Provider Profile

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/1`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderSelf>`; exact fields/messages/errors in E09. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider profile; Yes — Edit provider profile.

**Body:**

```json
{ "businessName": "Updated Services", "city": "Dhaka" }
```

#### P14 — Get Public Provider

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/2`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/{{providerProfileId}}`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `providerProfileId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderPublic>`; exact fields/messages/errors in E10. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider details; Yes — Public provider.

**Body:** none.

#### P15 — Get My Services

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/3`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/me/services?page=1&limit=10&status=ACTIVE&sortBy=createdAt&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `page=1&limit=10&status=ACTIVE&sortBy=createdAt&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<OwnService>>`; exact fields/messages/errors in E14. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider services; Yes — Own services.

**Body:** none.

#### P16 — Create Service

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/4`; folder `/03 - Provider`.
- **HTTP:** `POST {{baseUrl}}/api/v1/providers/me/services`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<OwnService>`; exact fields/messages/errors in E15. Saved observed response/status: NOT FOUND. Script status gate: 201.
- **Workflow / relevance:** `/03 - Provider` → Provider service form; Yes — Create service.

**Body:**

```json
{
  "categoryId": "{{categoryId}}",
  "title": "Example Service",
  "description": "Example description",
  "price": "1000.00",
  "duration": 60,
  "serviceArea": "Dhaka",
  "status": "ACTIVE"
}
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 201) pm.collectionVariables.set('serviceId', pm.response.json().data.id);
```

#### P17 — Update Service

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/5`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/services/{{serviceId}}`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `serviceId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<OwnService>`; exact fields/messages/errors in E16. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider service form; Yes — Edit service.

**Body:**

```json
{ "price": "1200.00", "status": "ACTIVE" }
```

#### P18 — Delete Service

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/6`; folder `/03 - Provider`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/providers/me/services/{{serviceId}}`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `serviceId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E17. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider services; Yes — Delete service.

**Body:** none.

#### P19 — Get My Availability

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/7`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/me/availability?serviceId={{serviceId}}&page=1&limit=10&sortOrder=asc`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `serviceId={{serviceId}}&page=1&limit=10&sortOrder=asc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<OwnSlot>>`; exact fields/messages/errors in E19. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider availability; Yes — Own slots.

**Body:** none.

#### P20 — Create Availability

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/8`; folder `/03 - Provider`.
- **HTTP:** `POST {{baseUrl}}/api/v1/providers/me/availability`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<OwnSlot>`; exact fields/messages/errors in E20. Saved observed response/status: NOT FOUND. Script status gate: 201.
- **Workflow / relevance:** `/03 - Provider` → Provider availability; Yes — Create slot.

**Body:**

```json
{ "serviceId": "{{serviceId}}", "startTime": "2030-01-01T10:00:00.000Z", "endTime": "2030-01-01T11:00:00.000Z" }
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 201) pm.collectionVariables.set('slotId', pm.response.json().data.id);
```

#### P21 — Update Availability

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/9`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/availability/{{slotId}}`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `slotId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<OwnSlot>`; exact fields/messages/errors in E21. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider availability; Yes — Edit slot.

**Body:**

```json
{ "startTime": "2030-01-01T12:00:00.000Z", "endTime": "2030-01-01T13:00:00.000Z" }
```

#### P22 — Delete Availability

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/10`; folder `/03 - Provider`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/providers/me/availability/{{slotId}}`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `slotId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E22. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider availability; Yes — Delete slot.

**Body:** none.

#### P23 — Get My Bookings

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/11`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/me/bookings?page=1&limit=10&status=PENDING&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders none; query `page=1&limit=10&status=PENDING&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<ProviderBooking>>`; exact fields/messages/errors in E27. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider jobs; Yes — Incoming/active/history jobs.

**Body:** none.

#### P24 — Get Provider Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/12`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/me/bookings/{{bookingId}}`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderBooking>`; exact fields/messages/errors in E28. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider job detail; Yes — Job detail.

**Body:** none.

#### P25 — Accept Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/13`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/bookings/{{bookingId}}/accept`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderBooking>`; exact fields/messages/errors in E29. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider job detail; Yes — Accept job.

**Body:** none.

#### P26 — Reject Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/14`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/bookings/{{bookingId}}/reject`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderBooking>`; exact fields/messages/errors in E30. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider job detail; Yes — Reject job.

**Body:** none.

#### P27 — Start Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/15`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/bookings/{{bookingId}}/start`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderBooking>`; exact fields/messages/errors in E31. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider job detail; Yes — Start job.

**Body:** none.

#### P28 — Complete Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/16`; folder `/03 - Provider`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/providers/me/bookings/{{bookingId}}/complete`.
- **Headers/auth:** `Authorization: Bearer {{providerAccessToken}}`; explicit Authorization = `Bearer {{providerAccessToken}}`; sample role `PROVIDER`; backend permits `PROVIDER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderBooking>`; exact fields/messages/errors in E32. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Provider job detail; Yes — Complete job.

**Body:** none.

#### P29 — Public Provider Reviews

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/17`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/{{providerProfileId}}/reviews?page=1&limit=10&rating=5&sortOrder=desc`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `providerProfileId`; query `page=1&limit=10&rating=5&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicReview>>`; exact fields/messages/errors in E42. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Service / Provider details; Yes — Public providers reviews.

**Body:** none.

#### P30 — Provider Rating Summary

- **Source:** `postman/Servexa.postman_collection.json#/item/3/item/18`; folder `/03 - Provider`.
- **HTTP:** `GET {{baseUrl}}/api/v1/providers/{{providerProfileId}}/rating-summary`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `providerProfileId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<RatingSummary>`; exact fields/messages/errors in E43. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/03 - Provider` → Service / Provider details; Yes — Live providers rating.

**Body:** none.

#### P31 — Public Category List

- **Source:** `postman/Servexa.postman_collection.json#/item/4/item/0`; folder `/04 - Categories`.
- **HTTP:** `GET {{baseUrl}}/api/v1/categories`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<Category[]>`; exact fields/messages/errors in E11. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/04 - Categories` → Catalog; Yes — Browse categories.

**Body:** none.

#### P32 — Admin Category List

- **Source:** `postman/Servexa.postman_collection.json#/item/4/item/1`; folder `/04 - Categories`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/categories?page=1&limit=10&search=home`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `page=1&limit=10&search=home`.
- **Expected success:** backend-derived HTTP 200, `S<Page<Category>>`; exact fields/messages/errors in E58. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/04 - Categories` → Admin categories; Yes — Category management list.

**Body:** none.

#### P33 — Admin Create Category

- **Source:** `postman/Servexa.postman_collection.json#/item/4/item/2`; folder `/04 - Categories`.
- **HTTP:** `POST {{baseUrl}}/api/v1/admin/categories`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<Category>`; exact fields/messages/errors in E59. Saved observed response/status: NOT FOUND. Script status gate: 201.
- **Workflow / relevance:** `/04 - Categories` → Admin category form; Yes — Create category.

**Body:**

```json
{ "name": "Example Category", "slug": "example-category", "description": "Example category" }
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 201) pm.collectionVariables.set('categoryId', pm.response.json().data.id);
```

#### P34 — Admin Update Category

- **Source:** `postman/Servexa.postman_collection.json#/item/4/item/3`; folder `/04 - Categories`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/admin/categories/{{categoryId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `categoryId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<Category>`; exact fields/messages/errors in E60. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/04 - Categories` → Admin category form; Yes — Edit category.

**Body:**

```json
{ "description": "Updated category" }
```

#### P35 — Admin Delete Category

- **Source:** `postman/Servexa.postman_collection.json#/item/4/item/4`; folder `/04 - Categories`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/admin/categories/{{categoryId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `categoryId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E61. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/04 - Categories` → Admin categories; Yes — Delete category.

**Body:** none.

#### P36 — Public Service List

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/0`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services?page=1&limit=10&sortBy=createdAt&sortOrder=desc`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `page=1&limit=10&sortBy=createdAt&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicService>>`; exact fields/messages/errors in E12. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Services; Yes — Discover services.

**Body:** none.

#### P37 — Public Service Detail

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/1`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services/{{serviceId}}`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `serviceId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<PublicService>`; exact fields/messages/errors in E13. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Service details; Yes — Service details.

**Body:** none.

#### P38 — Search Services

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/2`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services?search=repair&page=1&limit=10`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `search=repair&page=1&limit=10`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicService>>`; exact fields/messages/errors in E12. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Services; Yes — Discover services.

**Body:** none.

#### P39 — Filter by Category

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/3`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services?category={{categoryId}}`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `category={{categoryId}}`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicService>>`; exact fields/messages/errors in E12. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Services; Yes — Discover services.

**Body:** none.

#### P40 — Filter by Price

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/4`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services?minPrice=500&maxPrice=1500`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `minPrice=500&maxPrice=1500`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicService>>`; exact fields/messages/errors in E12. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Services; Yes — Discover services.

**Body:** none.

#### P41 — Filter by City

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/5`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services?city=Dhaka`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `city=Dhaka`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicService>>`; exact fields/messages/errors in E12. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Services; Yes — Discover services.

**Body:** none.

#### P42 — Service Availability

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/6`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services/{{serviceId}}/availability?from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&page=1&limit=10`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `serviceId`; query `from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&page=1&limit=10`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicSlot>>`; exact fields/messages/errors in E18. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Service details / Booking; Yes — Available slots.

**Body:** none.

#### P43 — Service Reviews

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/7`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services/{{serviceId}}/reviews?page=1&limit=10&sortOrder=desc`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `serviceId`; query `page=1&limit=10&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<PublicReview>>`; exact fields/messages/errors in E40. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Service / Provider details; Yes — Public services reviews.

**Body:** none.

#### P44 — Service Rating Summary

- **Source:** `postman/Servexa.postman_collection.json#/item/5/item/8`; folder `/05 - Services`.
- **HTTP:** `GET {{baseUrl}}/api/v1/services/{{serviceId}}/rating-summary`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders `serviceId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<RatingSummary>`; exact fields/messages/errors in E41. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/05 - Services` → Service / Provider details; Yes — Live services rating.

**Body:** none.

#### P45 — Create Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/6/item/0`; folder `/06 - Bookings`.
- **HTTP:** `POST {{baseUrl}}/api/v1/bookings`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<CustomerBooking>`; exact fields/messages/errors in E23. Saved observed response/status: NOT FOUND. Script status gate: 201.
- **Workflow / relevance:** `/06 - Bookings` → Booking; Yes — Create booking.

**Body:**

```json
{ "serviceId": "{{serviceId}}", "slotId": "{{slotId}}", "notes": "Please arrive on time." }
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 201) pm.collectionVariables.set('bookingId', pm.response.json().data.id);
```

#### P46 — My Bookings

- **Source:** `postman/Servexa.postman_collection.json#/item/6/item/1`; folder `/06 - Bookings`.
- **HTTP:** `GET {{baseUrl}}/api/v1/bookings/me?page=1&limit=10&status=PENDING&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders none; query `page=1&limit=10&status=PENDING&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<CustomerBooking>>`; exact fields/messages/errors in E24. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/06 - Bookings` → Customer bookings; Yes — Booking history.

**Body:** none.

#### P47 — Booking Detail

- **Source:** `postman/Servexa.postman_collection.json#/item/6/item/2`; folder `/06 - Bookings`.
- **HTTP:** `GET {{baseUrl}}/api/v1/bookings/{{bookingId}}`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<CustomerBooking>`; exact fields/messages/errors in E25. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/06 - Bookings` → Customer booking detail; Yes — Booking detail.

**Body:** none.

#### P48 — Cancel Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/6/item/3`; folder `/06 - Bookings`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/bookings/{{bookingId}}/cancel`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<CustomerBooking>`; exact fields/messages/errors in E26. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/06 - Bookings` → Customer booking detail; Yes — Cancel booking.

**Body:** none.

#### P49 — Initiate Stripe Checkout

- **Source:** `postman/Servexa.postman_collection.json#/item/7/item/0`; folder `/07 - Payments`.
- **HTTP:** `POST {{baseUrl}}/api/v1/payments/initiate/{{bookingId}}`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<Checkout>`; exact fields/messages/errors in E33. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/07 - Payments` → Booking payment; Yes — Start Checkout.

**Body:** none.

#### P50 — Get Payment by Booking

- **Source:** `postman/Servexa.postman_collection.json#/item/7/item/1`; folder `/07 - Payments`.
- **HTTP:** `GET {{baseUrl}}/api/v1/payments/booking/{{bookingId}}`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `bookingId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<PaymentState>`; exact fields/messages/errors in E34. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/07 - Payments` → Payment return / Booking detail; Yes — Payment reconciliation.

**Body:** none.

#### P51 — Stripe Webhook (documentation only)

- **Source:** `postman/Servexa.postman_collection.json#/item/7/item/2`; folder `/07 - Payments`.
- **HTTP:** `POST {{baseUrl}}/api/v1/payments/stripe/webhook`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Stripe signature`; backend permits `Stripe signature`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `{received:true}`; exact fields/messages/errors in E35. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/07 - Payments` → Server only; No browser request — server-only callback contract; documentation placeholder.

**Body:** none.

**Collection note:** Do not send manually: Stripe signs raw payloads. Use: stripe listen --forward-to http://localhost:5000/api/v1/payments/stripe/webhook

#### P52 — Payment Success Redirect (informational)

- **Source:** `postman/Servexa.postman_collection.json#/item/7/item/3`; folder `/07 - Payments`.
- **HTTP:** `GET {{baseUrl}}/payments/success?session_id={CHECKOUT_SESSION_ID}`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `session_id={CHECKOUT_SESSION_ID}`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E65. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/07 - Payments` → Payment return; Indirect — redirect destination behavior, not payment verification API.

**Body:** none.

#### P53 — Payment Cancel Redirect (informational)

- **Source:** `postman/Servexa.postman_collection.json#/item/7/item/4`; folder `/07 - Payments`.
- **HTTP:** `GET {{baseUrl}}/payments/cancel`.
- **Headers/auth:** `none`; explicit Authorization = `none`; sample role `Public`; backend permits `Public`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E66. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/07 - Payments` → Payment return; Indirect — redirect destination behavior, not payment verification API.

**Body:** none.

#### P54 — Create Review

- **Source:** `postman/Servexa.postman_collection.json#/item/8/item/0`; folder `/08 - Reviews`.
- **HTTP:** `POST {{baseUrl}}/api/v1/reviews`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 201, `S<OwnReview>`; exact fields/messages/errors in E36. Saved observed response/status: NOT FOUND. Script status gate: 201.
- **Workflow / relevance:** `/08 - Reviews` → Completed booking / Reviews; Yes — Write review.

**Body:**

```json
{ "bookingId": "{{bookingId}}", "rating": 5, "comment": "Excellent service" }
```

**Script (storage behavior, not assertion):**

```javascript
if (pm.response.code === 201) pm.collectionVariables.set('reviewId', pm.response.json().data.id);
```

#### P55 — My Reviews

- **Source:** `postman/Servexa.postman_collection.json#/item/8/item/1`; folder `/08 - Reviews`.
- **HTTP:** `GET {{baseUrl}}/api/v1/reviews/me?page=1&limit=10&rating=5&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders none; query `page=1&limit=10&rating=5&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<OwnReview>>`; exact fields/messages/errors in E37. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/08 - Reviews` → Customer reviews; Yes — Own reviews.

**Body:** none.

#### P56 — Update Review

- **Source:** `postman/Servexa.postman_collection.json#/item/8/item/2`; folder `/08 - Reviews`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/reviews/{{reviewId}}`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `reviewId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<OwnReview>`; exact fields/messages/errors in E38. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/08 - Reviews` → Customer reviews; Yes — Edit review.

**Body:**

```json
{ "rating": 4, "comment": "Updated review" }
```

#### P57 — Delete Review

- **Source:** `postman/Servexa.postman_collection.json#/item/8/item/3`; folder `/08 - Reviews`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/reviews/{{reviewId}}`.
- **Headers/auth:** `Authorization: Bearer {{customerAccessToken}}`; explicit Authorization = `Bearer {{customerAccessToken}}`; sample role `CUSTOMER`; backend permits `CUSTOMER`.
- **Parameters:** path placeholders `reviewId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E39. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/08 - Reviews` → Customer reviews; Yes — Delete review.

**Body:** none.

#### P58 — List Users

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/0`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/users?page=1&limit=10&status=ACTIVE&search=test&sortBy=createdAt&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `page=1&limit=10&status=ACTIVE&search=test&sortBy=createdAt&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<AdminUser>>`; exact fields/messages/errors in E52. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin users; Yes — User management list.

**Body:** none.

#### P59 — Get User

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/1`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/users/{{customerId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `customerId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<AdminUser>`; exact fields/messages/errors in E53. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin user detail; Yes — User detail.

**Body:** none.

#### P60 — Update User Status

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/2`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/admin/users/{{customerId}}/status`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `customerId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<AdminUser>`; exact fields/messages/errors in E54. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin users; Yes — User moderation.

**Body:**

```json
{ "status": "SUSPENDED" }
```

#### P61 — Soft Delete User

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/3`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/admin/users/{{customerId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `customerId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E55. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin users; Yes — Delete user.

**Body:** none.

#### P62 — List Providers

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/4`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/providers?page=1&limit=10&status=PENDING&search=example&sortBy=createdAt&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `page=1&limit=10&status=PENDING&search=example&sortBy=createdAt&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<AdminProvider>>`; exact fields/messages/errors in E56. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin providers; Yes — Provider moderation list.

**Body:** none.

#### P63 — Update Provider Status

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/5`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `PATCH {{baseUrl}}/api/v1/admin/providers/{{providerProfileId}}/status`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}; Content-Type: application/json`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `providerProfileId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<AdminProvider>`; exact fields/messages/errors in E57. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin providers; Yes — Provider approval/rejection.

**Body:**

```json
{ "status": "APPROVED" }
```

#### P64 — Admin Review List

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/6`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/reviews?page=1&limit=10&serviceId={{serviceId}}&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `page=1&limit=10&serviceId={{serviceId}}&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<AdminReview>>`; exact fields/messages/errors in E62. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin reviews; Yes — Review moderation list.

**Body:** none.

#### P65 — Admin Delete Review

- **Source:** `postman/Servexa.postman_collection.json#/item/9/item/7`; folder `/09 - Admin Users & Providers`.
- **HTTP:** `DELETE {{baseUrl}}/api/v1/admin/reviews/{{reviewId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `reviewId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<null>`; exact fields/messages/errors in E63. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/09 - Admin Users & Providers` → Admin reviews; Yes — Moderate review.

**Body:** none.

#### P66 — Overview

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/0`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/overview`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<Overview>`; exact fields/messages/errors in E44. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Marketplace counts.

**Body:** none.

#### P67 — Revenue

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/1`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/revenue?from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&providerId={{providerProfileId}}&serviceId={{serviceId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&providerId={{providerProfileId}}&serviceId={{serviceId}}`.
- **Expected success:** backend-derived HTTP 200, `S<Revenue>`; exact fields/messages/errors in E45. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Revenue totals.

**Body:** none.

#### P68 — Booking Analytics

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/2`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/bookings?from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&providerId={{providerProfileId}}&serviceId={{serviceId}}&customerId={{customerId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&providerId={{providerProfileId}}&serviceId={{serviceId}}&customerId={{customerId}}`.
- **Expected success:** backend-derived HTTP 200, `S<BookingMetrics>`; exact fields/messages/errors in E46. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Booking analytics.

**Body:** none.

#### P69 — Provider Analytics

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/3`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/providers`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ProviderMetrics>`; exact fields/messages/errors in E47. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Provider analytics.

**Body:** none.

#### P70 — Service Analytics

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/4`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/services`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<ServiceMetrics>`; exact fields/messages/errors in E48. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Service analytics.

**Body:** none.

#### P71 — Recent Activity

- **Source:** `postman/Servexa.postman_collection.json#/item/10/item/5`; folder `/10 - Admin Dashboard`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/dashboard/recent-activity?limit=20`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `limit=20`.
- **Expected success:** backend-derived HTTP 200, `S<Activity[]>`; exact fields/messages/errors in E49. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/10 - Admin Dashboard` → Admin dashboard; Yes — Recent audit activity.

**Body:** none.

#### P72 — List Audit Logs

- **Source:** `postman/Servexa.postman_collection.json#/item/11/item/0`; folder `/11 - Audit Logs`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/audit-logs?page=1&limit=20&action=BOOKING_CREATED&entityType=Booking&entityId={{bookingId}}&userId={{customerId}}&from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&sortOrder=desc`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders none; query `page=1&limit=20&action=BOOKING_CREATED&entityType=Booking&entityId={{bookingId}}&userId={{customerId}}&from=2030-01-01T00:00:00.000Z&to=2030-12-31T23:59:59.000Z&sortOrder=desc`.
- **Expected success:** backend-derived HTTP 200, `S<Page<Audit>>`; exact fields/messages/errors in E50. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/11 - Audit Logs` → Admin audit; Yes — Audit list.

**Body:** none.

#### P73 — Audit Log Detail

- **Source:** `postman/Servexa.postman_collection.json#/item/11/item/1`; folder `/11 - Audit Logs`.
- **HTTP:** `GET {{baseUrl}}/api/v1/admin/audit-logs/{{auditLogId}}`.
- **Headers/auth:** `Authorization: Bearer {{adminAccessToken}}`; explicit Authorization = `Bearer {{adminAccessToken}}`; sample role `ADMIN`; backend permits `ADMIN`.
- **Parameters:** path placeholders `auditLogId`; query `none`.
- **Expected success:** backend-derived HTTP 200, `S<Audit>`; exact fields/messages/errors in E51. Saved observed response/status: NOT FOUND. Script status gate: none.
- **Workflow / relevance:** `/11 - Audit Logs` → Admin audit detail; Yes — Audit detail.

**Body:** none.

## 3. Backend route audit and exact HTTP contracts

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

### Middleware and validation resolution

All E routes inherit Helmet and CORS. E35 webhook then uses `express.raw({type:'application/json'})` and Stripe signature verification; it runs before JSON parser/rate limiter. Remaining routes inherit `express.json()` and global rate limit. Public E routes have no auth guard. Any-auth E05–E07 use `auth()`. CUSTOMER/PROVIDER entries use exact `auth(UserRole.X)`; ADMIN endpoints inherit `adminRouter.use(auth(UserRole.ADMIN))`. Services apply the additional ownership/approval rules listed individually. App/global error middleware is shared; no validation middleware file exists—controllers call Zod `.parse()`.

Request aliases → exact controller-used validators:

| Alias | Validator function | File |
|---|---|---|
| Register/Login/TokenBody | registerValidationSchema / loginValidationSchema / refreshTokenValidationSchema / logoutValidationSchema | Auth/auth.validation.ts |
| PatchUser/PatchProvider | updateMyProfileValidationSchema / updateProviderProfileValidationSchema | User/user.validation.ts; Provider/provider.validation.ts |
| CreateCategory/PatchCategory/QCategories | createCategoryValidationSchema / updateCategoryValidationSchema / categoryListValidationSchema | Category/category.validation.ts |
| CreateService/PatchService/QServices/QOwnServices | createServiceValidationSchema / updateServiceValidationSchema / publicServiceListValidationSchema / providerServiceListValidationSchema | Service/service.validation.ts |
| CreateSlot/PatchSlot/QPublicSlots/QOwnSlots | createAvailabilityValidationSchema / updateAvailabilityValidationSchema / publicAvailabilityListValidationSchema / providerAvailabilityListValidationSchema | Availability/availability.validation.ts |
| CreateBooking/QBookings | createBookingValidationSchema / bookingListValidationSchema | Booking/booking.validation.ts |
| CreateReview/PatchReview/QReviews/QAdminReviews | createReviewValidationSchema / updateReviewValidationSchema / reviewListValidationSchema / adminReviewListValidationSchema | Review/review.validation.ts |
| QUsers/QProviders/UserStatusBody/ProviderStatusBody | listUsersValidationSchema / listProvidersValidationSchema / userStatusValidationSchema / providerStatusValidationSchema | Admin/admin.validation.ts |
| QRevenue/QBookingMetrics/QActivity/QAudit | revenueDashboardValidationSchema / bookingDashboardValidationSchema / recentActivityValidationSchema / auditLogListValidationSchema | Admin/dashboard.validation.ts |

Unused availabilityIdValidationSchema/bookingIdValidationSchema declarations do not establish route-level cuid checks. Bodyless booking action/payment initiation routes have no Zod body validator. The table plus E entries maps every route to its actual request schema, middleware, controller, service, response/error contract.

## 4. Postman to backend cross-check


**Coverage:**73 examples →66 unique method/path pairs, exactly66 backend explicit routes. Postman-only route:0. Backend-only route:0. Method/path mismatch:0. All explicit role-token headers match route permissions. The webhook request is deliberately incomplete for execution, as its name/description say. Dynamic DB existence, provider approval and workflow state cannot be proven by matching request syntax.

| Postman Request | Backend Route | Match? | Method | Auth | Notes |
|---|---|---|---|---|---|

| P01 Health | E64 `/health` | Yes (route) | GET | Public | Root path outside /api/v1; informational/operational response. |

| P02 Register Customer | E01 `/api/v1/auth/register` | Yes (route) | POST | Public | Body/query keys supported; response not saved. |

| P03 Register Provider | E01 `/api/v1/auth/register` | Yes (route) | POST | Public | Body/query keys supported; response not saved. |

| P04 Login Customer | E02 `/api/v1/auth/login` | Yes (route) | POST | Public | Gate200 stores role token + shared refreshToken; no assertion. |

| P05 Login Provider | E02 `/api/v1/auth/login` | Yes (route) | POST | Public | Gate200 stores role token + shared refreshToken; no assertion. |

| P06 Login Admin | E02 `/api/v1/auth/login` | Yes (route) | POST | Public | Gate200 stores role token + shared refreshToken; no assertion. |

| P07 Refresh Token | E03 `/api/v1/auth/refresh-token` | Yes (route) | POST | Public | Request matches; rotated tokens not stored by script. |

| P08 Logout | E04 `/api/v1/auth/logout` | Yes (route) | POST | Public | Body/query keys supported; response not saved. |

| P09 Get Current User | E05 `/api/v1/auth/me` | Yes (route) | GET | Any | Example customer token; backend also permits active PROVIDER/ADMIN. |

| P10 Get My Profile | E06 `/api/v1/users/me` | Yes (route) | GET | Any | Example customer token; backend also permits active PROVIDER/ADMIN. |

| P11 Update My Profile | E07 `/api/v1/users/me` | Yes (route) | PATCH | Any | Example customer token; backend also permits active PROVIDER/ADMIN. |

| P12 Get My Provider Profile | E08 `/api/v1/providers/me` | Yes (route) | GET | PROVIDER | Body/query keys supported; response not saved. |

| P13 Update My Provider Profile | E09 `/api/v1/providers/me` | Yes (route) | PATCH | PROVIDER | Body/query keys supported; response not saved. |

| P14 Get Public Provider | E10 `/api/v1/providers/:id` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P15 Get My Services | E14 `/api/v1/providers/me/services` | Yes (route) | GET | PROVIDER | Body/query keys supported; response not saved. |

| P16 Create Service | E15 `/api/v1/providers/me/services` | Yes (route) | POST | PROVIDER | Body/query keys supported; response not saved. |

| P17 Update Service | E16 `/api/v1/providers/me/services/:id` | Yes (route) | PATCH | PROVIDER | Body/query keys supported; response not saved. |

| P18 Delete Service | E17 `/api/v1/providers/me/services/:id` | Yes (route) | DELETE | PROVIDER | Body/query keys supported; response not saved. |

| P19 Get My Availability | E19 `/api/v1/providers/me/availability` | Yes (route) | GET | PROVIDER | Body/query keys supported; response not saved. |

| P20 Create Availability | E20 `/api/v1/providers/me/availability` | Yes (route) | POST | PROVIDER | Body/query keys supported; response not saved. |

| P21 Update Availability | E21 `/api/v1/providers/me/availability/:id` | Yes (route) | PATCH | PROVIDER | Body/query keys supported; response not saved. |

| P22 Delete Availability | E22 `/api/v1/providers/me/availability/:id` | Yes (route) | DELETE | PROVIDER | Body/query keys supported; response not saved. |

| P23 Get My Bookings | E27 `/api/v1/providers/me/bookings` | Yes (route) | GET | PROVIDER | Body/query keys supported; response not saved. |

| P24 Get Provider Booking | E28 `/api/v1/providers/me/bookings/:id` | Yes (route) | GET | PROVIDER | Body/query keys supported; response not saved. |

| P25 Accept Booking | E29 `/api/v1/providers/me/bookings/:id/accept` | Yes (route) | PATCH | PROVIDER | Body/query keys supported; response not saved. |

| P26 Reject Booking | E30 `/api/v1/providers/me/bookings/:id/reject` | Yes (route) | PATCH | PROVIDER | Syntax matches; current booking/payment state prerequisite required. |

| P27 Start Booking | E31 `/api/v1/providers/me/bookings/:id/start` | Yes (route) | PATCH | PROVIDER | Syntax matches; current booking/payment state prerequisite required. |

| P28 Complete Booking | E32 `/api/v1/providers/me/bookings/:id/complete` | Yes (route) | PATCH | PROVIDER | Syntax matches; current booking/payment state prerequisite required. |

| P29 Public Provider Reviews | E42 `/api/v1/providers/:providerId/reviews` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P30 Provider Rating Summary | E43 `/api/v1/providers/:providerId/rating-summary` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P31 Public Category List | E11 `/api/v1/categories` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P32 Admin Category List | E58 `/api/v1/admin/categories` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P33 Admin Create Category | E59 `/api/v1/admin/categories` | Yes (route) | POST | ADMIN | Body/query keys supported; response not saved. |

| P34 Admin Update Category | E60 `/api/v1/admin/categories/:id` | Yes (route) | PATCH | ADMIN | Body/query keys supported; response not saved. |

| P35 Admin Delete Category | E61 `/api/v1/admin/categories/:id` | Yes (route) | DELETE | ADMIN | Body/query keys supported; response not saved. |

| P36 Public Service List | E12 `/api/v1/services` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P37 Public Service Detail | E13 `/api/v1/services/:id` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P38 Search Services | E12 `/api/v1/services` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P39 Filter by Category | E12 `/api/v1/services` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P40 Filter by Price | E12 `/api/v1/services` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P41 Filter by City | E12 `/api/v1/services` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P42 Service Availability | E18 `/api/v1/services/:serviceId/availability` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P43 Service Reviews | E40 `/api/v1/services/:serviceId/reviews` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P44 Service Rating Summary | E41 `/api/v1/services/:serviceId/rating-summary` | Yes (route) | GET | Public | Body/query keys supported; response not saved. |

| P45 Create Booking | E23 `/api/v1/bookings` | Yes (route) | POST | CUSTOMER | Body/query keys supported; response not saved. |

| P46 My Bookings | E24 `/api/v1/bookings/me` | Yes (route) | GET | CUSTOMER | Body/query keys supported; response not saved. |

| P47 Booking Detail | E25 `/api/v1/bookings/:id` | Yes (route) | GET | CUSTOMER | Body/query keys supported; response not saved. |

| P48 Cancel Booking | E26 `/api/v1/bookings/:id/cancel` | Yes (route) | PATCH | CUSTOMER | Syntax matches; current booking/payment state prerequisite required. |

| P49 Initiate Stripe Checkout | E33 `/api/v1/payments/initiate/:bookingId` | Yes (route) | POST | CUSTOMER | Syntax matches; current booking/payment state prerequisite required. |

| P50 Get Payment by Booking | E34 `/api/v1/payments/booking/:bookingId` | Yes (route) | GET | CUSTOMER | Body/query keys supported; response not saved. |

| P51 Stripe Webhook (documentation only) | E35 `/api/v1/payments/stripe/webhook` | Yes (route) | POST | Stripe signature | Route matches; no signature/raw payload; documentation-only; not executable as saved. |

| P52 Payment Success Redirect (informational) | E65 `/payments/success` | Yes (route) | GET | Public | Root path outside /api/v1; informational/operational response. |

| P53 Payment Cancel Redirect (informational) | E66 `/payments/cancel` | Yes (route) | GET | Public | Root path outside /api/v1; informational/operational response. |

| P54 Create Review | E36 `/api/v1/reviews` | Yes (route) | POST | CUSTOMER | Body/query keys supported; response not saved. |

| P55 My Reviews | E37 `/api/v1/reviews/me` | Yes (route) | GET | CUSTOMER | Body/query keys supported; response not saved. |

| P56 Update Review | E38 `/api/v1/reviews/:id` | Yes (route) | PATCH | CUSTOMER | Body/query keys supported; response not saved. |

| P57 Delete Review | E39 `/api/v1/reviews/:id` | Yes (route) | DELETE | CUSTOMER | Body/query keys supported; response not saved. |

| P58 List Users | E52 `/api/v1/admin/users` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P59 Get User | E53 `/api/v1/admin/users/:id` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P60 Update User Status | E54 `/api/v1/admin/users/:id/status` | Yes (route) | PATCH | ADMIN | Body/query keys supported; response not saved. |

| P61 Soft Delete User | E55 `/api/v1/admin/users/:id` | Yes (route) | DELETE | ADMIN | Body/query keys supported; response not saved. |

| P62 List Providers | E56 `/api/v1/admin/providers` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P63 Update Provider Status | E57 `/api/v1/admin/providers/:id/status` | Yes (route) | PATCH | ADMIN | Body/query keys supported; response not saved. |

| P64 Admin Review List | E62 `/api/v1/admin/reviews` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P65 Admin Delete Review | E63 `/api/v1/admin/reviews/:id` | Yes (route) | DELETE | ADMIN | Body/query keys supported; response not saved. |

| P66 Overview | E44 `/api/v1/admin/dashboard/overview` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P67 Revenue | E45 `/api/v1/admin/dashboard/revenue` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P68 Booking Analytics | E46 `/api/v1/admin/dashboard/bookings` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P69 Provider Analytics | E47 `/api/v1/admin/dashboard/providers` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P70 Service Analytics | E48 `/api/v1/admin/dashboard/services` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P71 Recent Activity | E49 `/api/v1/admin/dashboard/recent-activity` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P72 List Audit Logs | E50 `/api/v1/admin/audit-logs` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

| P73 Audit Log Detail | E51 `/api/v1/admin/audit-logs/:id` | Yes (route) | GET | ADMIN | Body/query keys supported; response not saved. |

### Mismatch and evidence boundaries

| Area | Actual finding | Frontend impact |
|---|---|---|
| URL/method | All66 match after substitution/query removal | Use E paths; do not treat repeated search examples as new APIs |
| Request body | All example body keys/types align with validators once variables resolve; static slot timestamps2030 | Use exact backend limits, not only sparse examples; fixtures eventually expire |
| Authentication | Explicit tokens role-correct; no auth object; blank env can shadow collection-written token | Frontend must own token lifecycle instead of copying Postman variable scheme |
| Webhook auth | Example omits required signature/raw JSON on purpose | Never expose webhook “send” button; manual saved example400 is expected |
| Responses | No saved responses for73 requests; 8 scripts consume only a few fields | No observed payload mismatch can be established; use backend selected DTOs |
| Refresh | Backend rotates; example has no pair replacement script | Frontend must atomically replace both tokens |
| IDs | Collection declares customerId/providerProfileId but scripts do not populate them | Derive from authenticated responses; do not infer they are missing backend fields |
| Workflow | Linear collection order includes mutually exclusive actions/delete-before-use | Use explicit journey sequence and separate fixtures |
| Verify filename/path | Verify.ts absent; stripe-verify.ts imports sibling ./src that does not exist at its current root | Utility as located is not directly runnable without different placement/resolution; no source change performed |
| Verify fixture vs registration | Utility inserts approved provider, phone0, dummy password and ACCEPTED booking directly | Those fixture values/state bypass public validator/auth/booking flows; frontend must not imitate them |
| Verify assertions | Only initiation201 is explicitly asserted; status/amount/ownership flags are logged | Do not label logs as proof all business rules passed |

Documentation cross-check: API_SPEC66 count agrees; future-only availability wording is weaker in source when past from supplied; strict booking body rejects extra total fields instead of “ignoring” them; universal JSON errors have429/default404 exceptions; PROJECT_SPEC24 seeded services conflicts with actual six-category-only seed; API_SPEC deferred review QA text and PASS matrix/README completion assertions are inconsistent. Runtime outcome remains separate from these documentation claims.

## 5. Verify.ts analysis of the available stripe-verify.ts


Exact file requested `Verify.ts`: **NOT FOUND**. Available artifact `[../stripe-verify.ts](../stripe-verify.ts)` fully inspected,43 lines. Import paths lines2–5 point to `./src/...`; current source lives `./servexa-backend/src/...` relative to Assignment6. It is not inside backend tsconfig's `src/**/*.ts`, not a package script and not part of normal API runtime. Backend `tsc --noEmit` passing therefore does not validate this standalone utility's imports.

| Lines / stage | What code does | Hard check vs observation | Frontend relevance |
|---|---|---|---|
|1–5 imports | Stripe, Prisma, config, JWT helper/enums | Module resolution prerequisite; current path mismatch | Server-only dependencies; never browser imports |
|7–12 helper | Unique Date.now prefix; fetch to `http://127.0.0.1:5000`, Authorization Bearer; parse JSON | No response.ok guard/schema validation; helper default GET | Real paths/bodyless payment calls; fixed test origin differs from Postman localhost spelling only |
|14–15 preconditions | Requires configured Stripe key + any non-deleted category | Throws if absent; message says test key but no test-mode prefix check | Test credentials/mode not established by message alone |
|16–18 user fixtures | Prisma creates PROVIDER+APPROVED profile and CUSTOMER; dummy password, phone0 | Direct DB writes bypass registration/bcrypt/approval validators | Does not verify registration/login/admin approval; sample phone fails public min5 |
|19–22 business fixtures | Service100.00/duration60; slot now+1h→+2h; booking ACCEPTED with price100 fee10 total110; slot booked | Direct DB writes, not createBooking/acceptBooking | Hardcoded fixture fee is not proof deployed fee is10%; bypasses reservation/state machine |
|23–25 initiate | Locally generate access JWT → POST `/api/v1/payments/initiate/${booking.id}` | **Explicit assertion:** status must201 else throw | Frontend must obtain JWT through login; initiation response needs data.sessionId/paymentUrl |
|26–29 DB/gateway checks | Require Payment exists; retrieve Stripe session by response sessionId; count PAYMENT_INITIATED audit | Payment missing throws; Stripe SDK errors throw; audit count is only recorded | Checks creation/retrievability, not successful customer payment |
|30 own status | GET `/api/v1/payments/booking/${booking.id}` own token | status logged; no200 assertion and body not validated | Backend-derived expected200 PaymentState |
|31–32 other customer | Create second CUSTOMER/generate JWT; same GET with foreign owner | status logged; no404 assertion | Ownership expected404 from getPaymentStatus; code label `forbidden` is not403 proof |
|33 output | Prints diagnostic object | No equality asserts except earlier201 | Values must not be reported as actual observed test output when file alone supplied |
|34–42 finally | Deletes payment audit/payment/booking/slot/service/profile/user fixtures; disconnects Prisma | Cleanup can itself fail; no per-cleanup recovery | Not a frontend workflow; not executed in this analysis |

### Exact emitted diagnostic shape

| Output key | Type / derivation | Expected behavior from backend; assertion status |
|---|---|---|
| initStatus | number from initiation HTTP status |201 asserted |
| sessionId | string from Stripe retrieved session | Matches response data.sessionId if retrieval succeeds; no format assertion |
| hasUrl | boolean of init.body.data.paymentUrl |true expected; logged only |
| paymentStatus | PaymentStatus from DB |PENDING immediately after initiation unless external race; logged only |
| transactionMatches | payment.transactionId === session.id boolean |true expected; logged only |
| expected | booking.totalAmount.toString() |fixture110 as Decimal string, not gateway expected assertion |
| stripeAmount | session.amount_total number/null |11000 expected from current ×100 implementation; logged, not compared |
| currency | Stripe string/null |configured STRIPE_CURRENCY lowercased; defaultusd, live value UNKNOWN |
| auditInitiated | number count |Normally1 for fixture first initiation; no assertion |
| statusApi | own GET status number |200 backend-derived, logged only |
| otherCustomer | foreign GET status number |404 backend-derived, logged only (not403) |
| checkoutPaymentStatus | Stripe string |Not forced by script; normally unpaid before customer payment, observation UNKNOWN |

No script step opens/pays Checkout, emits/verifies signed webhook, confirms Booking, accepts via provider API, starts/completes work, creates review, tests refunds, duplicate sessions, failed payment events, token refresh, CORS or rate limiting. Successful initiation is not PAID/CONFIRMED. Finally deletes local records without expiring the external Stripe session; late callbacks could find missing Payment. Partial fixture setup can leave untracked rows if failure occurs before IDs are recorded. These are utility limitations only; this task neither runs nor repairs it.

**Three-source payment reconciliation:** Postman “Initiate Stripe Checkout” matches utility initiate endpoint and backend201 Checkout DTO. Postman “Get Payment by Booking” matches utility own/foreign GET; backend ownership explains200/404. Postman “Stripe Webhook (documentation only)” is not exercised by utility. Browser redirect examples are also not exercised. No saved utility output artifact was found to prove the diagnostic values observed during a past run.

## 6. Authentication

**Register:** POST `/api/v1/auth/register` with explicit CUSTOMER/PROVIDER → 201 AuthUser → POST login. Provider profile begins PENDING. No automatic login, welcome email, verification or OTP. ADMIN provisioning API/seed is NOT FOUND.

**Login:** POST `/api/v1/auth/login` → TokenPair in `data`, without user → GET `/api/v1/auth/me` or `/api/v1/users/me` using Bearer → store current role/profile status from response → render authorized navigation. Default expiry access15m/refresh30d is configurable; response has no expiresIn. JWT claims include userId, role, tokenType plus JWT timestamps. Login of a PENDING/REJECTED provider works if User.status ACTIVE.

**Refresh:** on protected 401, frontend contract is to serialize refresh attempts → POST `/auth/refresh-token` with saved refreshToken → replace both tokens → retry once. DB hash must be unrevoked/unexpired, user active/non-deleted, JWT role must match DB role. Transaction revokes old row and creates replacement. If refresh fails401, clear local auth and return to login; do not retry forever. There is no “all devices” or session listing API.

**Logout:** POST `/auth/logout` body refreshToken, no access token required → 200/null; remove frontend session. Access JWT remains usable until expiry while user remains active. A nonmatching token still returns success. Token storage medium is **UNSPECIFIED**: backend returns JSON, sets no cookies, mandates no localStorage/sessionStorage mechanism. Do not describe HttpOnly cookie sessions as implemented. Decide browser persistence as frontend architecture, keeping tokens out of URLs/logs/public state.

**Database role wins:** auth middleware verifies token then reads active/non-deleted user and uses current DB role for authorization, not only JWT role. Suspension/deletion causes protected requests401 and fresh login403; restoring user ACTIVE may allow still-valid old access JWT. Refresh rows are not revoked by status change/deletion; refresh checks current user state.

**Important token limitation:** `jwtHelper.ts` adds no random jti/session ID. Identical claims signed in the same second can produce identical tokens; rotation cannot be assumed to yield a distinct token string. Multiple same-second login rows can have the same tokenHash. Serialize client refresh, but backend replay/rotation assurance remains NEEDS VERIFICATION.

Forgot/reset/change password, email verification, OTP, social login, magic links, permission scopes, cookie sessions: **NOT FOUND**. Do not build functioning screens for those flows. Evidence: `Auth/*`, `src/helpers/jwtHelper.ts`, `src/app/middlewares/auth.ts`, `src/utils/tokenHash.ts`.

## 7. All user roles

| Role | Allowed APIs/actions | Restrictions | Backend-derived dashboard/profile |
|---|---|---|---|
| Visitor | Public categories/services/slots/provider detail/reviews/rating, register/login/refresh/logout | No writes to marketplace; no public provider index | Catalog, service/provider detail, auth |
| CUSTOMER | Any-auth profile, `/bookings*`, `/payments/initiate/*`, `/payments/booking/*`, `/reviews*` own resources | Cannot act as provider/admin; foreign booking/review returns404 | Own booking list/detail and embedded payment status, profile, own reviews; no dedicated customer dashboard API |
| PROVIDER | Any-auth profile, provider self/profile/services/availability/jobs; own public review views | Create service, all slot mutations, all booking operations require APPROVED; profile edit/service read-edit-delete do not | Service manager, slots, requests/active/history, provider profile/status; no earnings/withdrawals API |
| ADMIN | `/admin/*`, any-auth own user profile, public APIs | Does not inherit CUSTOMER/PROVIDER routes; cannot self-delete/suspend/block; cannot change user roles | Metrics, users, providers, categories, review moderation, audit |

No WORKER/SUPER_ADMIN roles. Provider user ID and provider profile ID are distinct; booking assignment points to profile. No custom permissions/grants. Evidence: routes and service guards, `prisma/schema.prisma` enums.

Postman uses customerAccessToken/providerAccessToken/adminAccessToken as sample actors; Any-auth profile/me examples only show customer, but backend permits all three active roles. Verify utility fabricates only two roles (PROVIDER/CUSTOMER), not ADMIN; its direct JWT generation is test-side only.

## 8. Complete business workflow

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

### Role-specific sequences

Register PROVIDER → login → GET providers/me → show PENDING approval → admin sets APPROVED → POST providers/me/services → POST providers/me/availability → GET providers/me/bookings?status=PENDING → accept/reject → wait for CONFIRMED → start → complete. Use the same booking list filtered by status for active/history tabs; do not assume combined status arrays supported.

Profile editing accepts businessName/bio/phone/city/address; no identity documents, avatar, verification upload or rejection reason. Approval is administrative ProviderStatus only. Service updates/deletion remain callable for PENDING/REJECTED providers, whereas create/slot mutation/job listing/actions are approval-gated. Slot overlap is across all services belonging to the provider, with exact boundary adjacency allowed; no duration alignment, recurring schedule or vacation model.

Provider receives customer name/phone in ProviderBooking, not customer email/address/GPS. Reviews are accessible via own profile ID's public review/summary APIs; there is no provider-only review management route. Earnings, balances, payouts, withdrawal history, notifications and online/offline switch: NOT FOUND. Admin analytics providerRevenue is not a provider payout API. Evidence: `Provider/provider.route.ts`, Service/Availability/Booking services.

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

Implemented: user list/detail/status/soft-delete; provider list/status approval; category list/create/update/soft-delete; all-review list/soft-delete; six dashboard read APIs and audit list/detail. Full contracts are E entries and matrix §12.

Not implemented: admin booking list/detail/manual transition/reassignment; admin payment list/detail/refund; service mutation/moderation; provider identity verification documents; complaints/disputes; notification sending; runtime settings; role editing; admin creation. Dashboard bookings/services/payments counts are analytics, not CRUD authorization.

Metrics semantics matter: overview entities exclude their deletedAt but provider counts can include suspended users; booking/payment history remains counted. Revenue filters Booking.createdAt and includes PAID payments, sums totalAmount and platformFee, derives providerRevenue = gross-platform. Provider ranking sums completed-booking totalAmount (not net earnings), while most-booked-service ranking includes all booking statuses. No currency field/time-series is returned from revenue dashboard. Audit recent activity is an event log, not an inbox. Evidence: `Admin/admin.route.ts`, `Admin/admin.service.ts`, `Admin/dashboard.service.ts`.

## 9. Booking and job state machine


| Current State | Action | API | Next State | Who Can Trigger |
|---|---|---|---|---|
| PENDING | accept | PATCH `/api/v1/providers/me/bookings/:id/accept` | ACCEPTED | Approved owning provider |
| PENDING | reject | PATCH `/api/v1/providers/me/bookings/:id/reject` | REJECTED | Approved owning provider, payment notPAID |
| PENDING | cancel | PATCH `/api/v1/bookings/:id/cancel` | CANCELLED | Owning customer, payment notPAID |
| ACCEPTED | payment confirmed | POST `/api/v1/payments/stripe/webhook` with verified completed paid session | CONFIRMED | Stripe signed callback |
| ACCEPTED | cancel | PATCH `/api/v1/bookings/:id/cancel` | CANCELLED | Owning customer, payment notPAID |
| CONFIRMED | start | PATCH `/api/v1/providers/me/bookings/:id/start` | IN_PROGRESS | Approved owning provider |
| CONFIRMED | cancel | PATCH `/api/v1/bookings/:id/cancel` | CANCELLED | Owning customer, only if payment notPAID; normally blocked |
| IN_PROGRESS | complete | PATCH `/api/v1/providers/me/bookings/:id/complete` | COMPLETED | Approved owning provider |
| COMPLETED / CANCELLED / REJECTED | none | none | none | Terminal; attempted action409 |

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

## 10. All data models and frontend TypeScript types

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

Frontend API types required are fully listed in §3.2: enums, TokenPair, AuthUser/UserProfile/ProviderSelf/ProviderPublic/AdminUser/AdminProvider, Category/PublicService/OwnService, PublicSlot/OwnSlot, CustomerBooking/ProviderBooking, PaymentState/Checkout, Review variants/RatingSummary, Activity/Audit and all dashboard metrics. Add generic Success<T>, Page<T> and normalized ApiError locally; these are client types, not new backend fields. Keep DecimalString and DateString serialized until formatting, and preserve nullable values.

## 11. Frontend page inventory


**PROPOSED client routes**, not pre-existing frontend/backend routes. All APIs below are E contracts in §3. Client and backend may share `/payments/success` names but serve on different origins; APP_BASE_URL determines where Stripe redirects. Shared403/not-found fallback screens are local UI, no extra APIs. Backend endpoints do not prescribe visual design or component library.

Each page below specifies purpose, dependency, data/actions/forms and loading/empty/error behavior. Form alias validation is exactly §3.3; query alias defaults exactly §3.4. Mutations disable only the relevant pending action and preserve inputs on failure. Shared auth handling is §6; server authorization remains authoritative.

### UI01 — `/` (Public)

- **Purpose:** Catalog entry/landing. **Required API:** E11 E12.
- **Data displayed:** Category links and eligible service cards.
- **User actions:** Browse categories, open services/provider.
- **Forms / validation:** No mutation; search→QServices.
- **Loading:** Category/card placeholders.
- **Empty:** No published services; categories can still show.
- **Error:** Independent catalog error/retry.

### UI02 — `/services` (Public)

- **Purpose:** Searchable catalog. **Required API:** E11 E12.
- **Data displayed:** PublicService cards, provider city, Decimal price, meta.
- **User actions:** Search/filter/sort/page, open detail.
- **Forms / validation:** QServices exact keys; omit empty and minPrice0.
- **Loading:** Keep filters; fetching indicator.
- **Empty:** No matches; reset filters.
- **Error:** 400 filter message,429 backoff.

### UI03 — `/services/:serviceId` (Public)

- **Purpose:** Detail, scheduling and reviews. **Required API:** E13 E18 E40 E41.
- **Data displayed:** PublicService, PublicSlot[], PublicReview[], live RatingSummary.
- **User actions:** Select slot, open provider, proceed booking.
- **Forms / validation:** QPublicSlots/QReviews; page independently.
- **Loading:** Separate service/slot/review loading.
- **Empty:** No slots/no reviews independently.
- **Error:** 404 detail; slot empty is not404; broken image fallback.

### UI04 — `/providers/:providerId` (Public)

- **Purpose:** Provider profile and offerings. **Required API:** E10 E12 E42 E43.
- **Data displayed:** ProviderPublic, services?provider, review summary/list.
- **User actions:** Open offered service; filter/page reviews.
- **Forms / validation:** QServices(provider=profileId), QReviews.
- **Loading:** Profile plus separately loaded lists.
- **Empty:** No services/reviews.
- **Error:** 404 unavailable profile; ignore unfiltered count as visible count.

### UI05 — `/register` (Public)

- **Purpose:** Customer/provider signup. **Required API:** E01.
- **Data displayed:** Role-specific input and success state.
- **User actions:** Select CUSTOMER/PROVIDER, submit, go login.
- **Forms / validation:** Register contract; conditional required provider fields.
- **Loading:** Disable submit while pending.
- **Empty:** Empty form initially, not resource-empty.
- **Error:** 400 field errors,409 email conflict.

### UI06 — `/login` (Public)

- **Purpose:** Authenticate any of three roles. **Required API:** E02 E05.
- **Data displayed:** Credentials, auth error.
- **User actions:** Login→store pair→GET me→role home.
- **Forms / validation:** Login contract; no admin register link.
- **Loading:** Submit pending then identity loading.
- **Empty:** Empty form; no dataset.
- **Error:** 401 credentials,403 inactive, network failure; do not auto-refresh login.

### UI07 — `/account/profile` (Any)

- **Purpose:** Own user name/phone. **Required API:** E06 E07.
- **Data displayed:** UserProfile incl read-only email/role/status.
- **User actions:** Edit name/phone.
- **Forms / validation:** PatchUser; changed nonempty fields only.
- **Loading:** Load profile/disable save.
- **Empty:** No profile is auth error, not empty list.
- **Error:** 400 field mapping;401 session handling.

### UI08 — `/customer` (CUSTOMER)

- **Purpose:** Booking overview. **Required API:** E24.
- **Data displayed:** Own bookings/meta and status tabs.
- **User actions:** Open booking, browse services.
- **Forms / validation:** QBookings; totals from meta only.
- **Loading:** List skeleton.
- **Empty:** No bookings→catalog link.
- **Error:** Auth/error state, retry safe reads.

### UI09 — `/customer/bookings` (CUSTOMER)

- **Purpose:** Booking history/status. **Required API:** E24.
- **Data displayed:** CustomerBooking list and payment summary.
- **User actions:** Filter status/service, paginate.
- **Forms / validation:** QBookings.
- **Loading:** List loading.
- **Empty:** No matching bookings.
- **Error:** 401/403/429/general read errors.

### UI10 — `/customer/bookings/new?serviceId=...&slotId=...` (CUSTOMER)

- **Purpose:** Review selected slot and create request. **Required API:** E13 E18 E23.
- **Data displayed:** Service/slot/time, notes; final price after creation.
- **User actions:** Revalidate slot, submit once, navigate returned booking.id.
- **Forms / validation:** CreateBooking only serviceId/slotId/notes; no address/amount.
- **Loading:** Verify current slot, submit pending.
- **Empty:** Selected slot unavailable→choose again.
- **Error:** 404 hidden service,409 slot conflict; do not invent success.

### UI11 — `/customer/bookings/:bookingId` (CUSTOMER)

- **Purpose:** Track booking/payment and eligible actions. **Required API:** E25 E26 E33 E34 E36 E37.
- **Data displayed:** CustomerBooking; PaymentState on payment panel; review eligibility.
- **User actions:** Cancel if eligible; initiate Checkout ifACCEPTED; review afterCOMPLETED.
- **Forms / validation:** Bodyless cancel/payment; CreateReview; map own reviews by bookingId.
- **Loading:** Detail/payment/actions independently pending.
- **Empty:** No payment record→UNPAID; no review.
- **Error:** 404 owned resource;409 state/paid cancellation; unknown mutation outcome→refetch.

### UI12 — `/payments/success` (CUSTOMER return context)

- **Purpose:** Reconcile hosted Checkout success return. **Required API:** E34 E25; E65 backend informational alternative.
- **Data displayed:** Authoritative PaymentState and booking status.
- **User actions:** Read remembered bookingId; bounded refresh; link booking/history.
- **Forms / validation:** No payment confirmation body; session_id is not a lookup key.
- **Loading:** Confirmation pending until serverPAID.
- **Empty:** Missing context→booking history, not success claim.
- **Error:** 401 re-login then return,404 unavailable, persistentPENDING explanation.

### UI13 — `/payments/cancel` (CUSTOMER return context)

- **Purpose:** Explain Checkout cancellation. **Required API:** E34 E25; E66 backend informational alternative.
- **Data displayed:** Current unchanged payment/booking status.
- **User actions:** Return to booking, check status before retry.
- **Forms / validation:** No mutation merely from redirect.
- **Loading:** Load status if context available.
- **Empty:** Missing context→booking history.
- **Error:** No automatic CANCELLED/refund claim; no blind initiate retry.

### UI14 — `/customer/reviews` (CUSTOMER)

- **Purpose:** Own review management. **Required API:** E37 E38 E39; create E36 from completed booking.
- **Data displayed:** OwnReview list and related service/booking.
- **User actions:** Edit rating/comment; soft-delete.
- **Forms / validation:** PatchReview; rating numeric1–5; nullable clear comment.
- **Loading:** List/save/delete pending.
- **Empty:** No visible reviews; deleted one may still block recreate.
- **Error:** 400 validation,404 deleted,409 create duplicate.

### UI15 — `/provider` (PROVIDER)

- **Purpose:** Provider workspace/status. **Required API:** E08; E27 only ifAPPROVED.
- **Data displayed:** ProviderSelf status; own job overview if approved.
- **User actions:** Open profile/services/availability/jobs.
- **Forms / validation:** No dashboard mutation.
- **Loading:** Profile before job queries.
- **Empty:** PENDING/REJECTED is approval state; no jobs is separate.
- **Error:** 403 on job access is approval limitation, not logout.

### UI16 — `/provider/profile` (PROVIDER)

- **Purpose:** Business profile. **Required API:** E08 E09.
- **Data displayed:** ProviderSelf, read-only rating/status and nested user.
- **User actions:** Edit allowed business fields.
- **Forms / validation:** PatchProvider.
- **Loading:** Load/save pending.
- **Empty:** Missing404 profile error.
- **Error:** 400 field errors; cannot edit approval status.

### UI17 — `/provider/services` (PROVIDER)

- **Purpose:** Manage own services. **Required API:** E14 E17.
- **Data displayed:** OwnService list/status/category.
- **User actions:** List/filter/delete/open editor/create.
- **Forms / validation:** QOwnServices; delete no body.
- **Loading:** List/delete pending.
- **Empty:** No services; create allowed ifAPPROVED.
- **Error:** 404 missing; no fake active-booking deletion prohibition.

### UI18 — `/provider/services/new` (PROVIDER)

- **Purpose:** Create offering. **Required API:** E11 E15.
- **Data displayed:** Category choices, service form.
- **User actions:** Submit and return to list.
- **Forms / validation:** CreateService; approval required; existing URL only.
- **Loading:** Load categories/save pending.
- **Empty:** No categories→no valid create selection.
- **Error:** 403 approval;404 category;400 fields.

### UI19 — `/provider/services/:serviceId/edit` (PROVIDER)

- **Purpose:** Edit own offering. **Required API:** E14 E16 E11.
- **Data displayed:** OwnService fields (not PublicService).
- **User actions:** Save changed fields.
- **Forms / validation:** PatchService; no own-service detail GET; resolve via paginated own list/cache.
- **Loading:** Resolve record/categories,save pending.
- **Empty:** If not on current list page, load other pages before declaring unavailable.
- **Error:** 404 from patch; public detail cannot substitute for inactive own record.

### UI20 — `/provider/availability` (PROVIDER)

- **Purpose:** Own slots and scheduling. **Required API:** E19 E20 E21 E22 E14.
- **Data displayed:** OwnSlot times/isBooked, service ref.
- **User actions:** Filter, create, edit, delete unbooked.
- **Forms / validation:** CreateSlot/PatchSlot; UTC/offset; end>start; future; approved.
- **Loading:** List/service options/actions pending.
- **Empty:** No slots; no active service→create/activate service first.
- **Error:** 409 overlap/booked,404 active service, possibleFK500 on retained booking slot.

### UI21 — `/provider/bookings` (PROVIDER)

- **Purpose:** Incoming/active/history jobs. **Required API:** E27.
- **Data displayed:** ProviderBooking with customer phone/name.
- **User actions:** Status tabs, page, open detail.
- **Forms / validation:** QBookings; APPROVED profile.
- **Loading:** Approval-aware fetching.
- **Empty:** No matching jobs.
- **Error:** 403 approval,401 inactive; prevent useless retry.

### UI22 — `/provider/bookings/:bookingId` (PROVIDER)

- **Purpose:** Job lifecycle. **Required API:** E28 E29 E30 E31 E32.
- **Data displayed:** ProviderBooking, slot, customer contact, payment summary.
- **User actions:** PENDING accept/reject; CONFIRMED start; IN_PROGRESS complete.
- **Forms / validation:** Bodyless action endpoints, no arbitrary status body.
- **Loading:** Detail/action pending.
- **Empty:** Missing booking→404 state.
- **Error:** 409 refetch,404 ownership,403 approval; no optimistic status.

### UI23 — `/provider/reviews` (PROVIDER)

- **Purpose:** Read own public reputation. **Required API:** E08 E42 E43.
- **Data displayed:** PublicReview and live RatingSummary.
- **User actions:** Filter/page/read only.
- **Forms / validation:** QReviews(profile ID fromE08).
- **Loading:** Profile then list/summary.
- **Empty:** No reviews→0 count.
- **Error:** Profile404; review read errors; no reply/delete API.

### UI24 — `/admin` (ADMIN)

- **Purpose:** Marketplace dashboard. **Required API:** E44 E45 E46 E47 E48 E49.
- **Data displayed:** Overview/revenue/booking/provider/service metrics;Activity[].
- **User actions:** Filter supported metrics; follow audit activity.
- **Forms / validation:** QRevenue/QBookingMetrics/QActivity; other panels no filter.
- **Loading:** Independent panel states.
- **Empty:** Zero totals/empty ranks/activity.
- **Error:** Panel-specific errors;401/403 guard; no invented timeseries.

### UI25 — `/admin/users` (ADMIN)

- **Purpose:** Manage users. **Required API:** E52 E54 E55.
- **Data displayed:** AdminUser page.
- **User actions:** Search/filter/status/delete/open detail.
- **Forms / validation:** QUsers, UserStatusBody; bodyless delete.
- **Loading:** List and row mutation pending.
- **Empty:** No users match.
- **Error:** 400 same/self status/self delete;404 gone; no role change.

### UI26 — `/admin/users/:userId` (ADMIN)

- **Purpose:** Inspect user. **Required API:** E53 E54 E55.
- **Data displayed:** AdminUser incl profile summary.
- **User actions:** Change status/delete.
- **Forms / validation:** UserStatusBody.
- **Loading:** Load/action pending.
- **Empty:** 404 not found.
- **Error:** 400 self protections,401/403.

### UI27 — `/admin/providers` (ADMIN)

- **Purpose:** Approval/moderation. **Required API:** E56 E57.
- **Data displayed:** AdminProvider list and nested user status.
- **User actions:** Search/filter, set status different from current.
- **Forms / validation:** QProviders, ProviderStatusBody.
- **Loading:** List/row pending.
- **Empty:** No pending/matching providers.
- **Error:** 400 target inactive/same status;404 missing; no documents UI.

### UI28 — `/admin/categories` (ADMIN)

- **Purpose:** Category CRUD. **Required API:** E58 E59 E60 E61.
- **Data displayed:** Category page.
- **User actions:** Create/edit/soft-delete.
- **Forms / validation:** QCategories; CreateCategory/PatchCategory; form may be modal.
- **Loading:** List/save/delete pending.
- **Empty:** No categories.
- **Error:** 409 name/slug/active-services;404 missing;400 fields.

### UI29 — `/admin/reviews` (ADMIN)

- **Purpose:** Review moderation. **Required API:** E62 E63.
- **Data displayed:** AdminReview incl deletedAt/providerId.
- **User actions:** Search/filter, delete visible review.
- **Forms / validation:** QAdminReviews; no edit/restore.
- **Loading:** List/delete pending.
- **Empty:** No matches.
- **Error:** 404 already-deleted; render deleted rows without delete action.

### UI30 — `/admin/audit-logs` (ADMIN)

- **Purpose:** Audit inspection. **Required API:** E50.
- **Data displayed:** Audit page; sanitized snapshots/actor.
- **User actions:** Exact filters/date/page, open detail.
- **Forms / validation:** QAudit.
- **Loading:** List loading.
- **Empty:** No matching logs.
- **Error:** 400 invalid range,401/403/read errors.

### UI31 — `/admin/audit-logs/:auditLogId` (ADMIN)

- **Purpose:** Audit detail. **Required API:** E51.
- **Data displayed:** Audit JSON snapshots, metadata.
- **User actions:** Read safely and return.
- **Forms / validation:** No mutation.
- **Loading:** Detail loading.
- **Empty:** 404 unavailable.
- **Error:** 404/read error; render JSON as text, not HTML.

## 12. Complete API to UI mapping


All66 routes are included, with relevance exceptions explicit. Paths are backend paths; frontend page labels correspond to §11. Body/query/DTO aliases fully expand in §3. Path parameters are also defined per E record. All 73 Postman examples map to these records; repeated search/login examples share APIs.

| Frontend Feature | Page | API | Method | Auth | Request | Response | UI Action |
|---|---|---|---|---|---|---|---|

| E01 Registration | Register | `/api/v1/auth/register` | POST | Public | Register; none | HTTP201 `AuthUser` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E02 Login | Login | `/api/v1/auth/login` | POST | Public | Login; none | HTTP200 `TokenPair` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E03 Refresh session | Session adapter | `/api/v1/auth/refresh-token` | POST | Public | TokenBody; none | HTTP200 `TokenPair` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E04 Logout | Account menu | `/api/v1/auth/logout` | POST | Public | TokenBody; none | HTTP200 `null` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E05 Current identity | Session adapter | `/api/v1/auth/me` | GET | Any | none; none | HTTP200 `AuthUser` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E06 Own profile | Profile | `/api/v1/users/me` | GET | Any | none; none | HTTP200 `UserProfile` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E07 Edit user profile | Profile | `/api/v1/users/me` | PATCH | Any | PatchUser; none | HTTP200 `UserProfile` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E08 Provider profile | Provider profile | `/api/v1/providers/me` | GET | PROVIDER | none; none | HTTP200 `ProviderSelf` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E09 Edit provider profile | Provider profile | `/api/v1/providers/me` | PATCH | PROVIDER | PatchProvider; none | HTTP200 `ProviderSelf` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E10 Public provider | Provider details | `/api/v1/providers/:id` | GET | Public | none; none | HTTP200 `ProviderPublic` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E11 Browse categories | Catalog | `/api/v1/categories` | GET | Public | none; none | HTTP200 `Category[]` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E12 Discover services | Services | `/api/v1/services` | GET | Public | none; QServices | HTTP200 `Page<PublicService>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E13 Service details | Service details | `/api/v1/services/:id` | GET | Public | none; none | HTTP200 `PublicService` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E14 Own services | Provider services | `/api/v1/providers/me/services` | GET | PROVIDER | none; QOwnServices | HTTP200 `Page<OwnService>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E15 Create service | Provider service form | `/api/v1/providers/me/services` | POST | PROVIDER | CreateService; none | HTTP201 `OwnService` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E16 Edit service | Provider service form | `/api/v1/providers/me/services/:id` | PATCH | PROVIDER | PatchService; none | HTTP200 `OwnService` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E17 Delete service | Provider services | `/api/v1/providers/me/services/:id` | DELETE | PROVIDER | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E18 Available slots | Service details / Booking | `/api/v1/services/:serviceId/availability` | GET | Public | none; QPublicSlots | HTTP200 `Page<PublicSlot>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E19 Own slots | Provider availability | `/api/v1/providers/me/availability` | GET | PROVIDER | none; QOwnSlots | HTTP200 `Page<OwnSlot>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E20 Create slot | Provider availability | `/api/v1/providers/me/availability` | POST | PROVIDER | CreateSlot; none | HTTP201 `OwnSlot` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E21 Edit slot | Provider availability | `/api/v1/providers/me/availability/:id` | PATCH | PROVIDER | PatchSlot; none | HTTP200 `OwnSlot` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E22 Delete slot | Provider availability | `/api/v1/providers/me/availability/:id` | DELETE | PROVIDER | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E23 Create booking | Booking | `/api/v1/bookings` | POST | CUSTOMER | CreateBooking; none | HTTP201 `CustomerBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E24 Booking history | Customer bookings | `/api/v1/bookings/me` | GET | CUSTOMER | none; QBookings | HTTP200 `Page<CustomerBooking>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E25 Booking detail | Customer booking detail | `/api/v1/bookings/:id` | GET | CUSTOMER | none; none | HTTP200 `CustomerBooking` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E26 Cancel booking | Customer booking detail | `/api/v1/bookings/:id/cancel` | PATCH | CUSTOMER | none; none | HTTP200 `CustomerBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E27 Incoming/active/history jobs | Provider jobs | `/api/v1/providers/me/bookings` | GET | PROVIDER | none; QBookings | HTTP200 `Page<ProviderBooking>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E28 Job detail | Provider job detail | `/api/v1/providers/me/bookings/:id` | GET | PROVIDER | none; none | HTTP200 `ProviderBooking` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E29 Accept job | Provider job detail | `/api/v1/providers/me/bookings/:id/accept` | PATCH | PROVIDER | none; none | HTTP200 `ProviderBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E30 Reject job | Provider job detail | `/api/v1/providers/me/bookings/:id/reject` | PATCH | PROVIDER | none; none | HTTP200 `ProviderBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E31 Start job | Provider job detail | `/api/v1/providers/me/bookings/:id/start` | PATCH | PROVIDER | none; none | HTTP200 `ProviderBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E32 Complete job | Provider job detail | `/api/v1/providers/me/bookings/:id/complete` | PATCH | PROVIDER | none; none | HTTP200 `ProviderBooking` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E33 Start Checkout | Booking payment | `/api/v1/payments/initiate/:bookingId` | POST | CUSTOMER | none; none | HTTP201 `Checkout` | Initiate once; retain bookingId; navigate paymentUrl; reconcile viaE34. |

| E34 Payment reconciliation | Payment return / Booking detail | `/api/v1/payments/booking/:bookingId` | GET | CUSTOMER | none; none | HTTP200 `PaymentState` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E35 Gateway event | Server only | `/api/v1/payments/stripe/webhook` | POST | Stripe signature | Raw Stripe event; none | HTTP200 `{received:true}` | No browser call. Stripe callback only; frontend reads E34. |

| E36 Write review | Completed booking / Reviews | `/api/v1/reviews` | POST | CUSTOMER | CreateReview; none | HTTP201 `OwnReview` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E37 Own reviews | Customer reviews | `/api/v1/reviews/me` | GET | CUSTOMER | none; QReviews | HTTP200 `Page<OwnReview>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E38 Edit review | Customer reviews | `/api/v1/reviews/:id` | PATCH | CUSTOMER | PatchReview; none | HTTP200 `OwnReview` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E39 Delete review | Customer reviews | `/api/v1/reviews/:id` | DELETE | CUSTOMER | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E40 Public services reviews | Service / Provider details | `/api/v1/services/:serviceId/reviews` | GET | Public | none; QReviews | HTTP200 `Page<PublicReview>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E41 Live services rating | Service / Provider details | `/api/v1/services/:serviceId/rating-summary` | GET | Public | none; none | HTTP200 `RatingSummary` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E42 Public providers reviews | Service / Provider details | `/api/v1/providers/:providerId/reviews` | GET | Public | none; QReviews | HTTP200 `Page<PublicReview>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E43 Live providers rating | Service / Provider details | `/api/v1/providers/:providerId/rating-summary` | GET | Public | none; none | HTTP200 `RatingSummary` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E44 Marketplace counts | Admin dashboard | `/api/v1/admin/dashboard/overview` | GET | ADMIN | none; none | HTTP200 `Overview` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E45 Revenue totals | Admin dashboard | `/api/v1/admin/dashboard/revenue` | GET | ADMIN | none; QRevenue | HTTP200 `Revenue` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E46 Booking analytics | Admin dashboard | `/api/v1/admin/dashboard/bookings` | GET | ADMIN | none; QBookingMetrics | HTTP200 `BookingMetrics` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E47 Provider analytics | Admin dashboard | `/api/v1/admin/dashboard/providers` | GET | ADMIN | none; none | HTTP200 `ProviderMetrics` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E48 Service analytics | Admin dashboard | `/api/v1/admin/dashboard/services` | GET | ADMIN | none; none | HTTP200 `ServiceMetrics` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E49 Recent audit activity | Admin dashboard | `/api/v1/admin/dashboard/recent-activity` | GET | ADMIN | none; QActivity | HTTP200 `Activity[]` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E50 Audit list | Admin audit | `/api/v1/admin/audit-logs` | GET | ADMIN | none; QAudit | HTTP200 `Page<Audit>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E51 Audit detail | Admin audit detail | `/api/v1/admin/audit-logs/:id` | GET | ADMIN | none; none | HTTP200 `Audit` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E52 User management list | Admin users | `/api/v1/admin/users` | GET | ADMIN | none; QUsers | HTTP200 `Page<AdminUser>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E53 User detail | Admin user detail | `/api/v1/admin/users/:id` | GET | ADMIN | none; none | HTTP200 `AdminUser` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E54 User moderation | Admin users | `/api/v1/admin/users/:id/status` | PATCH | ADMIN | UserStatusBody; none | HTTP200 `AdminUser` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E55 Delete user | Admin users | `/api/v1/admin/users/:id` | DELETE | ADMIN | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E56 Provider moderation list | Admin providers | `/api/v1/admin/providers` | GET | ADMIN | none; QProviders | HTTP200 `Page<AdminProvider>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E57 Provider approval/rejection | Admin providers | `/api/v1/admin/providers/:id/status` | PATCH | ADMIN | ProviderStatusBody; none | HTTP200 `AdminProvider` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E58 Category management list | Admin categories | `/api/v1/admin/categories` | GET | ADMIN | none; QCategories | HTTP200 `Page<Category>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E59 Create category | Admin category form | `/api/v1/admin/categories` | POST | ADMIN | CreateCategory; none | HTTP201 `Category` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E60 Edit category | Admin category form | `/api/v1/admin/categories/:id` | PATCH | ADMIN | PatchCategory; none | HTTP200 `Category` | Submit exact input when allowed; use response; invalidate dependent data; handle errors from E contract. |

| E61 Delete category | Admin categories | `/api/v1/admin/categories/:id` | DELETE | ADMIN | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E62 Review moderation list | Admin reviews | `/api/v1/admin/reviews` | GET | ADMIN | none; QAdminReviews | HTTP200 `Page<AdminReview>` | Load/render selected DTO; apply supported filters; show loading/empty/error. |

| E63 Moderate review | Admin reviews | `/api/v1/admin/reviews/:id` | DELETE | ADMIN | none; none | HTTP200 `null` | Confirm intent in UI; delete; refetch list; HTTP200 data:null. |

| E64 Health | Operational probe | `/health` | GET | Public | none; none | HTTP200 `null` | Operational probe only; not required on every page. |

| E65 Checkout success redirect | Payment return | `/payments/success` | GET | Public | none; ignored session_id | HTTP200 `null` | Informational backend return; frontend return page independently reads E34 with bookingId. |

| E66 Checkout cancel redirect | Payment return | `/payments/cancel` | GET | Public | none; none | HTTP200 `null` | Informational backend return; frontend return page independently reads E34 with bookingId. |

## 13. Search filter sort and pagination

§3.4 defines every accepted query, data type/default/sort field and matching rule. §3.5 maps each listing endpoint to it. Lists use offset `(page-1)*limit`; no cursors, stable tie-breaker IDs, faceting, category counts or full-text relevance ordering. Sorting is one field only. Empty arrays are successful responses, not errors; pages beyond totalPages remain empty with the requested page value.

Public provider browsing is service discovery + provider detail; GET `/providers` does not exist. Admin provider listing cannot power a public provider directory. Public categories return an unpaginated array and ignore search. Provider slots default limit20; bookings/reviews/services/admin users/providers/categories default10; audit default20; recent activity is a limited array default20.

Public slots default future filtering but supplied past from bypasses the future cutoff; booking still rejects start<=now. From/to validation permits equal boundaries although slot errors say “later than”. Admin metrics/audit dates use coercion rather than strict ISO validator, but frontend contract should send unambiguous timezone-bearing ISO strings.

## 14. Payment initiation verification and reconciliation

1. Customer keeps bookingId from booking detail; booking must be ACCEPTED.
2. POST `/api/v1/payments/initiate/:bookingId`, Bearer, no body. Backend loads own booking total, creates/reuses STRIPE Payment, then Stripe hosted Checkout in payment mode, one line item named service.title, amount = Decimal total ×100 rounded to integer. Currency is global lowercased STRIPE_CURRENCY, default usd. Zero-decimal-currency compatibility is not implemented.
3. Receive `201 S<{paymentUrl,sessionId}>`; navigate to paymentUrl. No Stripe.js/publishable key is required by this hosted-redirect implementation.
4. Stripe returns browser to `${APP_BASE_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}` or `${APP_BASE_URL}/payments/cancel`. APP_BASE_URL defaults to backend localhost origin. Both backend root handlers return JSON; neither confirms/changes payment.
5. Signed server webhook `checkout.session.completed` with payment_status paid finds matching metadata.paymentId + bookingId + transactionId=session.id; checks amount/currency; sets PAID/paidAt and ACCEPTED→CONFIRMED atomically with PAYMENT_SUCCESS audit. Non-paid completed sessions return without mutation. Other valid unrelated Stripe events return `{received:true}`.
6. Frontend return page queries GET `/payments/booking/:bookingId` and refetches booking. It must retain bookingId across redirect in its own state; no endpoint maps session_id to booking and cancellation return URL has no booking ID. Render “confirmation pending” until API reports PAID; stop aggressive retries on error.

Payment states actually written: initial UNPAID record → PENDING after successful session setup → PAID on matched completed webhook. FAILED handler exists but looks up transactionId by PaymentIntent ID while initialization stores Checkout Session ID: normal failure reconciliation is inconsistent. CANCELLED/REFUNDED are enum values only, no route writes them. No refund, verification-by-session-ID, invoice/receipt, provider payout, payment history list or expiry cleanup. Booking list contains payment summary; status API contains more fields but no gatewayResponse.

Retry/concurrency limitations: initiation for existing PENDING payment creates another session and overwrites transactionId, so older session's completed webhook may404. No Stripe idempotency key, current-session reuse, explicit webhook event-ID dedup table or Checkout expiry handling. Paid-state guard is present, but not all concurrent event races are guarded. Cancelling ACCEPTED booking with payment PENDING is allowed; previously created Checkout may still collect payment, then webhook cannot confirm CANCELLED booking (409). Frontend must not claim cancellation also cancelled the payment session/refunded funds.

Evidence: `Payment/payment.service.ts::{initiatePayment,getPaymentStatus,finalizeCheckout,markPaymentFailed}`, `Payment/payment.controller.ts::webhook`, `Payment/stripe.service.ts`, `src/app.ts`.

Postman P identifiers are in §2/§4; payment utility expected201/init DTO and own200/foreign404 are in §5. No artifact proves a browser return means settled payment. Do not use Verify fixture110 or Postman service price1000 as global currency/fee configuration. A customer transaction-history UI can only be composed from own booking history plus per-booking status; there is no standalone payment-history list.

## 15. Slot and availability contract


Exact APIs: public E18; provider E19–E22; customer booking E23/E26; provider reject E30. Validate selection using public slot IDs and keep datetime offsets. `AvailabilitySlot` is a concrete interval tied to one provider profile and service; no arbitrary date booking, capacity, recurrence, rescheduling or worker dispatch.

| Frontend action → API | Backend processing → response → state | Next frontend behavior |
|---|---|---|
| Browse slots → E18 | Public service eligibility; isBooked=false; start>=from(defaultnow); Page<PublicSlot> | Select exact ID; empty is valid even if service missing |
| Provider creates → E20 | Approved profile/active owned service; future and end>start; check provider-wide overlap; OwnSlot,201 | Refresh own slots; adjacent intervals allowed |
| Provider edits → E21 | Same checks; reject isBooked=true; merged times validated | Refresh list; no optimistic collision-free promise |
| Provider deletes → E22 | Approved profile/ownership; reject booked; hard DB delete | Remove only after200; retained Booking FK can produce500 |
| Customer selects→E23 | Slot/service match, visibility/future, atomic false→true; create unique-slot PENDING booking | Navigate booking; server totals authoritative |
| Slot stale/conflict→E23 | isBooked/past/unique conflict409 | Refetch E18; retain notes, clear invalid selection |
| Cancel→E26 / reject→E30 | Eligible state + nonPAID; sets isBooked=false but retains Booking.slotId unique | Refetch; do not claim this slot is reusable |
| Rebook same released slot→E23 | Existing Booking unique slotId blocks create →409 rollback | Backend-supported successful reuse unavailable; choose a genuinely new slot |
| Reschedule | No route | Do not manufacture PATCH booking slotId or delete/recreate promise |

Postman “Create Availability” uses2030-01-01 10:00–11:00Z and “Update Availability”12:00–13:00Z; these are example fixtures, not business hours. Verify utility creates a slot now+1h/2h directly and marks booked by Prisma; it does not verify availability APIs/overlap/atomic reservation. Editing a released slot can affect historical booking presentation because the relation points to the same mutable row. Overlap check lacks DB exclusion lock; concurrent different intervals can race. These are documented source semantics; no backend fix is included.

## 16. Rating and review contract


| Action | API / backend function | Eligibility and result |
|---|---|---|
| Create | E36 POST reviews / createReview | Own COMPLETED booking and active customer; numeric integer1–5, optional trimmed comment<=2000;201 OwnReview; duplicate409 |
| Update | E38 PATCH reviews/:id / updateReview | Own non-deleted review; optional rating or nullable comment, at least one;200 OwnReview |
| Delete own | E39 DELETE reviews/:id / softDeleteReview | Own non-deleted; soft-delete;200/null |
| Fetch own | E37 GET reviews/me / listMyReviews | Own non-deleted Page<OwnReview>; query rating/page/limit/sortOrder |
| Public service/provider | E40/E42 / listPublicReviews | Non-deleted reviews only; no parent visibility check; Page<PublicReview> |
| Rating summaries | E41/E43 / ratingSummary | Non-deleted DB aggregate, averageRating numeric rounded2, reviewCount; no reviews→0/0 |
| Admin list/delete | E62/E63 / listAdminReviews/softDeleteReview | List includes deletedAt; delete only non-deleted; no restore |

Stored ProviderProfile.rating/totalReviews are not recalculated in these functions. Service/provider cards may return stale values; live summary APIs provide separate actual aggregates. Sorting providers by rating still sorts stored value and cannot be fixed by client display replacement. Source: Review/review.service.ts; Provider/provider.service.ts; Admin/admin.service.ts.

Postman “Create Review” rating5, “Update Review” rating4 conform; scripts only capture reviewId after201. No saved example proves review eligibility/aggregation/deletion outcome. Utility does not touch reviews. One unique Review.bookingId survives soft delete, so create-after-delete409 even though reviews/me no longer shows it. Booking DTO has no review field; map own reviews by bookingId, but absence cannot prove a deleted review never existed. Show API conflict if duplicate; do not promise re-review.

## 17. Notification and realtime

In-app notifications, read/unread state, push subscription, SMS, backend email templates/sending and realtime notifications: NOT FOUND in schema, routes, imports or dependencies. No notification event payload exists. Successful writes often create AuditLog in the same transaction; this is only exposed through ADMIN audit/recent-activity APIs.

Actual audit actions: PROVIDER_PROFILE_UPDATED; USER_STATUS_CHANGED; USER_SOFT_DELETED; PROVIDER_STATUS_CHANGED; CATEGORY_CREATED/CATEGORY_UPDATED/CATEGORY_SOFT_DELETED; SERVICE_CREATED/SERVICE_UPDATED/SERVICE_SOFT_DELETED; AVAILABILITY_CREATED/AVAILABILITY_UPDATED/AVAILABILITY_DELETED; BOOKING_CREATED/BOOKING_CANCELLED/BOOKING_ACCEPTED/BOOKING_REJECTED/BOOKING_STARTED/BOOKING_COMPLETED; PAYMENT_INITIATED/PAYMENT_SUCCESS/PAYMENT_FAILED; REVIEW_CREATED/REVIEW_UPDATED/REVIEW_DELETED/REVIEW_ADMIN_DELETED. Auth and User own-profile update have no audit calls. PAYMENT_SUCCESS records payment status and bookingId; no separate BOOKING_CONFIRMED audit event.

Provider city/address and Service.serviceArea are strings. Service city filter uses provider.city case-insensitive equality; there are no latitude/longitude, radius, distance, address-book or live-tracking fields/APIs. Map provider/key NOT FOUND. No WebSocket URL, event namespace, emit/listen or payload contract. Booking tracking uses ordinary GET APIs. Stripe webhooks are server-to-server callbacks and are not browser subscriptions.

Frontend-derived handling: refresh relevant GET data after mutation, on return from Checkout and when revisiting a job. If periodic polling is chosen, keep it bounded/backed off because all normal requests share 100 requests/15min/IP; a fast multi-panel polling loop will exceed this. No server polling interval recommendation or SSE alternative is implemented.

## 18. File and image upload

Upload/delete-file endpoints, multipart parser, storage bucket, signed URLs, file size/type checks: **NOT FOUND**. The only image input is Service.imageUrl, optional nullable trimmed text <=2048; it accepts non-URL strings. Provider/customer avatar not in schema. Frontend can edit/display an existing image URL using service create/patch, with missing/broken-image handling. There is no backend-supported “upload image” sequence or returned storage URL. Image hosting/public URL source remains UNKNOWN and must not be invented as an existing integration.

## 19. Error contract

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

Postman/Verify status distinction: Postman stores values conditionally, not assertions; Verify only enforces initiation201. Foreign payment status is404 by source, not403 despite utility variable name `forbidden`. No saved error examples exist. E entries specify each important API success/status/DTO and explicit business errors; generic DB/network failures must still be handled.

## 20. Frontend state architecture

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


### Server state versus UI state (PROPOSED)

| State category | Owner | Examples | Persistence/invalidation contract |
|---|---|---|---|
| Server-authoritative | Query cache from API | Current user, approval, services, slots, bookings, payments, reviews, admin metrics/audit | Key by userId/role where private; invalidate on related mutation; clear private cache on logout/account switch |
| Auth transport | Small auth/session store | accessToken, refreshToken, hydration phase, one in-flight refresh promise | Not a generic query-cache payload; no persistent token logging; backend has no mandated storage medium |
| URL/UI filters | Route search params | Search text submitted, page, sort, status, date filters | Validate/coerce before API; reset page on filter change; no backend persistence |
| Local form/UI | Component/form state | Draft notes, selected slot, dirty fields, open dialog, validation errors, pending action | Preserve on failure; invalid slot clears selection only; no optimistic server transition |
| Checkout recovery | Per-tab session context | userId + bookingId + sessionId from initiation | Store before redirect; match owner on return; missing context→history; not authoritative payment proof |

Suggested query-key families: `['me',userId]`, `['services',filters]`, `['service',id]`, `['slots',serviceId,filters]`, `['bookings',userId,filters]`, `['booking',userId,id]`, `['providerBookings',userId,filters]`, `['payment',userId,bookingId]`, `['reviews',scope,id,filters]`, `['ratingSummary',scope,id]`, `['admin',userId,resource,filters]`. Scope IDs are profile/service IDs as appropriate. These names are proposals, not backend fields.

On book/cancel/reject: invalidate own bookings, relevant detail, public slots and provider own slots if present in current-role cache. On provider job action: own job lists/detail; cross-user customer cache cannot be pushed without realtime. On payment return: payment+booking detail/history. On review write/delete: own reviews, public list and live rating summaries; invalidation cannot repair stored profile rating. On service/profile moderation: relevant public/own listings, profiles and admin analytics as needed. Do not refetch every admin dashboard panel on every unrelated keystroke.

No distinct Order state: Booking is the actual model. No Notification/worker GPS/withdrawal state because there is no backing API. Server entities must not be copied into an independently mutable Redux-like store alongside the query cache.

## 21. Security and environment requirements

Backend expects Bearer JWT, current active user, route role, ownership and provider approval where coded. Frontend route guards mirror those rules for usability; server still makes the decision. Handle role403/identity401 distinctly. No cookie CSRF flow exists; do not add cookie assumptions. Browser origin must be explicitly allowed by backend CORS. No client permission-grant management is supported.

Keep password/token values out of debug logs, URLs and shared caches; clear account-scoped cache on identity switch. Password is write-only and never in selected user DTOs. Display only returned public/private fields in their intended audience; provider has customer phone, admin has email/phone/IP/user-agent, public APIs do not expose those private user fields. Audit snapshot keys are redacted server-side but free-text values remain arbitrary user/admin data; render as text, not trusted HTML. imageUrl is plain unvalidated text, so frontend should restrict rendering to acceptable image URL schemes as a frontend handling choice, not claim server upload validation.

Helmet and global rate limit exist; login has no separate limiter/account lockout. No file restrictions because no upload endpoint. Gateway secrets/signature verification remain on server; frontend only follows returned Checkout URL and reads status. Do not let client amounts control payment. Do not expose DB/generated authentication models or server environment secrets in frontend. No special CORS exposed-header list is configured, so do not assume RateLimit headers are browser-readable cross-origin.

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

Utility JWT generation and DB dummy credentials are not frontend code patterns. Postman credential samples must not be shipped in frontend env/source/demo-login UI. A proposed frontend token persistence strategy must acknowledge this backend has JSON tokens, no HttpOnly cookie endpoint; do not invent a BFF/session cookie flow within this no-backend-change task.

## 22. Edge cases

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

Additional artifact-supported cases: imported Postman environment shadows tokens/IDs; shared refreshToken switches role when another login runs; refresh script does not replace rotated pair; empty providerProfileId/customerId requires explicit population; linear collection order invalidates its own fixtures; Verify fixture bypasses user validators; Verify reads/logs404 ownership without assertion; Verify external Checkout can outlive fixture cleanup; current utility import paths do not match workspace. These are §2/§5 findings, not new product features.

## 23. Frontend technology recommendation


**PROPOSED stack**, not a discovered frontend requirement. `../servexa-frontend/` is empty; backend package is strict TypeScript/ESM REST and supplies no React/Vue/Next.js mandate. A standalone React SPA fits the existing separate API and three role-based workspaces without introducing another server or changing backend auth.

| Concern | Recommendation | Why it fits / source |
|---|---|---|
| Framework/build | React + Vite `react-ts` template | Independent frontend directory and static output; documented template. [Vite guide](https://vite.dev/guide/) |
| Language | TypeScript strict | Exact DTOs/nullable unions; align with backend TS without importing Prisma/secret code |
| Routing | React Router declarative BrowserRouter | URL-based public/private layouts and guards; TanStack Query owns server data to avoid duplicate route-fetch orchestration. [Router modes](https://reactrouter.com/start/modes) |
| API client | Native fetch wrapper | One base URL, Bearer injection, AbortSignal, safe JSON/text parse, normalized errors, one refresh replay; no extra HTTP package required |
| Server state/cache | TanStack Query | Query keys, deduplication/invalidation; configure retries/refetch to respect100/15min/IP. [Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) |
| Session/UI state | React context + reducer/hooks; form state local | Only transport tokens/session lifecycle need shared local state; no Redux requirement |
| Forms | React Hook Form | Form state/error handling; frontend Zod schema resolver where selected. [Official repository](https://github.com/react-hook-form/react-hook-form) |
| Validation | Frontend Zod schemas matching backend behavior; initial Zod3-compatible API for parity | Backend installed3.x; latest docs do not imply upgrade backend or copy Zod4-only syntax. Recreate public field rules, not server Prisma imports. [Zod docs](https://zod.dev/) |
| UI system | Project-local accessible primitives: button/input/select/table/dialog/status badge/pagination | No existing UI library/design system mandate; no need to add a canvas/design tool for analysis-only task |
| Styling | CSS Modules + shared CSS variables | Low-dependency responsive layouts, consistent focus/spacing/colors; no backend impact |
| Unit/integration | Vitest for adapters/guards/state-derived UI behavior | Vite-oriented testing; selected peer/runtime versions must be compatible. [Vitest guide](https://vitest.dev/guide/) |
| Browser journeys | Playwright | Role journeys, redirect recovery, rendering and error states. [Playwright introduction](https://playwright.dev/docs/intro) |

Version policy: pin a compatible set in the future frontend package lock; no packages installed in this task. Backend `node>=20` does not guarantee current Vite compatibility: official guide requires20.19+ or22.12+ and some templates may require more. Check actual frontend tool versions/runtime when implementing. Do not upgrade backend to accommodate frontend tooling. [Vite compatibility](https://vite.dev/guide/).

Query policy proposal: no continuous polling by default; set explicit staleTime, disable automatic retries for400/401/403/404/409/429, centralize401 refresh, at most a small bounded retry for safe transient GET failures. No automatic mutation retries. On Checkout return use one bounded, visibility-aware status check sequence with backoff and a manual refresh fallback; stop atPAID/terminal/error/budget timeout. Avoid simultaneous payment+booking polling when one response already includes bookingStatus. TanStack default stale refetches/retries must be configured intentionally. [Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

Frontend browser paths require SPA history fallback on hosting; API base origin should remain explicit. Proposed public variable name `VITE_API_BASE_URL` contains only backend `/api/v1` base, never secrets; this name does not already exist. Root payment redirects/health use origin-only paths when needed. Configure frontend dev origin to an already permitted origin (defaultlocalhost3000) or agree deployment CORS config; do not assume Vite's default5173 is allowed. APP_BASE_URL must target the chosen return-page host. Deployment hosting choice remains unspecified.

## 24. FRONTEND IMPLEMENTATION CONTRACT


This contract is a future implementation plan grounded in the existing backend. No backend code change, invented route, seeded credential, simulated payment completion or replacement business rule is authorized by this document.

### Architecture and routes

Implement in `../servexa-frontend/` as a separate strict TypeScript app. Proposed organization:

```text
src/
  app/          router, query provider, auth provider, role layouts
  api/          fetch client, error normalizer, envelope types, endpoint services
  contracts/    selected DTOs, enums, body/query schemas
  features/
    auth/ profile/ catalog/ availability/ bookings/ payments/ reviews/ admin/
  components/   form fields, table, pagination, skeleton, empty/error state, status badges
  lib/          datetime/decimal display, route helpers
  styles/       CSS variables and shared styles
tests/          adapter/state tests and browser journeys
```

Client pages/routes are the complete UI01–UI31 inventory in §11. Create PublicLayout, authenticated customer/provider/admin layouts and403/404 fallbacks. Restore identity before protected page data fetch. User role guard and separate provider-approval guard must match E contract; pending provider may still view/edit own profile and existing services. ADMIN does not inherit CUSTOMER/PROVIDER permissions. After login navigate using current me.role, not selected login button or stale JWT claim.

### Components and forms

Reusable components: AuthForm, UserProfileForm, ProviderProfileForm, ServiceCard, ServiceEditor, CategoryEditor, SlotPicker, AvailabilityEditor, BookingSummary, BookingStatusBadge, PaymentStatusPanel, BookingActionBar, ReviewForm/ReviewList, DataTable, Pagination, FilterBar, MetricCard, AuditJsonViewer and request-state components. These are proposed UI units with only existing fields, not new backend functionality.

Forms exactly follow §3.3. Auth role union is CUSTOMER/PROVIDER only; enum selects uppercase backend values. Price input sends validated positive decimal string; show server amounts without recalculating authoritative fees. Blank optional strings/null clearing follow each schema; omit unsupported keys. Slot local datetime converts to offset-bearing ISO, end>start and future locally checked, but server409 remains authoritative. Rating body sends number, never string. Display field400 paths and root errors separately. No file picker pretending to upload; imageUrl text field only.

### API layer, data and authentication

One typed service per auth/profile/catalog/availability/booking/payment/review/admin group; all E01–E66 accounted for in §12 with E35 callback and E64 operational exceptions. Expose DTOs from §3.2 and request/query aliases; parse S<T> vs Page<T> correctly; handle PaymentState union. No browser Prisma/DB/Stripe-secret dependency. API errors normalize `{status,message,fieldErrors,retryAfter?,rawKind}` as a **client-only type**; retain backend status semantics.

Fetch wrapper sends JSON when body exists, injects current Bearer only for protected calls, handles content-type fallbacks, aborts stale list requests and centralizes one in-flight refresh. Exclude login/refresh/logout from recursive refresh logic. Refresh pair replaces both tokens before replay; failed refresh clears session/private caches and returns to login. Guard against a stale refresh resolving after logout/account change (session generation check). Backend token-storage policy is unspecified: proposed default keeps tokens in memory; if reload persistence is needed, a documented per-tab storage decision is required with XSS implications, not a claim of HttpOnly support. Checkout bookingId/sessionId context may use per-tab sessionStorage; restore account ownership before displaying private state. If login is required after redirect, preserve only internal return path/context, not token in URL.

### Business workflows and state

Customer: register/login → catalog/detail → valid slot→POST booking → PENDING→wait for ACCEPTED → Checkout initiation → redirect→serverPAID/CONFIRMED → provider starts/completes → one review. Show immutable booked amount snapshots and live related fields distinctly where relevant. Cancellation only where transition/payment allow; no refund/reschedule capability.

Provider: register→PENDING profile→admin approval→create service→create slots→own requests→accept/reject→confirmed jobs→start→complete. Use profile ID for public reviews, user ID only where endpoint owns user. No earnings/withdrawals/worker assignment/verification upload.

Admin: own profile plus users/status/delete, providers/status, category CRUD, review moderation, six reporting APIs, audit list/detail. No invented admin booking/payment CRUD, arbitrary service editing, settings or role editor. Display metrics with actual source semantics, not payout balances or time-series absent from DTOs.

Server state and local state ownership follow §20. Mutations refetch/invalidate; never optimistically mark paymentPAID or bookingCOMPLETED. Distinguish user status, provider approval, service status, booking state and payment state. Disable duplicate clicks but still handle server race/conflict; frontend cannot correct released-slot uniqueness or failed-event ID mapping.

### Loading empty and error requirements

Every page implements its §11 states. Auth hydration is distinct from unauthenticated; no private-data flash. Lists render skeleton/empty/error separately, preserve filters, use meta.total/totalPages. Detail404 is not an empty-list screen. Independent dashboard/review/slot panels can fail independently. Show mutation pending and preserve drafts. Render dates in chosen UI timezone with conversion from actual ISO; unknown duration unit must be labelled only after agreement. Format money for agreed currency; no invented BDT from Dhaka examples.

### Payment and integration boundaries

Pay only accepted own booking with E33. Store context before browser navigation. On return reconcile via E34 and E25; success URL/session_id is not verification. Handle pending delayed webhook, missing context, API/network failure, owner mismatch, cancelled booking with pending Checkout and duplicate-initiation risk. Provide status/history route recovery without manufacturing a server session lookup. Stripe.js/publishable key unnecessary for current hosted URL flow. Refund/history-list/withdrawals are NOT FOUND; do not render actionable fake flows.

Notifications, WebSocket/SSE/Socket.IO, maps/live tracking and upload storage are NOT FOUND. Do not create notification counts or live events. Optional request/refetch is not realtime. Provider/customer reviews are ordinary reads; audit is ADMIN-only and not an inbox.

### Required frontend testing plan (future work, not executed here)

| Test scope | Expected acceptance behavior |
|---|---|
| Contract adapter | S<T>/Page<T>, decimal strings, nullable fields, minimalUNPAID, JSON400/AppError, text429/default404 and network failure correctly represented |
| Authentication | Signup roles, login→me, one concurrent refresh for multiple401s, rotated pair stored, logout no stale-refresh resurrection, role403 does not trigger refresh loop |
| Role/page guards | CUSTOMER/PROVIDER/ADMIN separation; pending provider approved-only actions hidden/blocked but allowed profile/service edits remain |
| Catalog/forms | Exact filter names/defaults, page reset, unavailable service404, slot empty, required/nullable/body enums, number rating, extra fields omitted |
| Booking happy path | CustomerPENDING→providerACCEPTED→real sandbox webhookCONFIRMED→IN_PROGRESS→COMPLETED→review; no browser-forced confirmation |
| Slot/conflicts | Concurrent/stale slot409; cancelled/rejected slot rebooking limitation visible; date offsets/end/future/overlap; response stale isBooked refetched |
| Payment | Initiation201 URL/context; own status200/foreign404; return page pending; failed/delayed webhook status; duplicate initiate not blindly retried; missing context recovery |
| Review | Completed-own eligibility,1–5 numeric, update/delete, deleted duplicate409, public aggregate vs stored stale profile difference |
| Admin | Self-block/delete400, same status400, inactive provider target400, category active-service409, review deleted rows, audit redaction/read-only |
| Reliability/accessibility | Keyboard forms/dialogs, error focus, narrow layouts, slow requests, empty pages, abort stale searches, rate-limit handling and private-cache clearing |

Use mocked HTTP for deterministic UI states plus separately controlled real backend/Stripe sandbox journeys. No frontend test may assert an invented refund/reschedule/notification endpoint. Tests should expose known backend semantics rather than expect fixes. Do not run the existing Postman collection linearly as the acceptance suite; isolate fixtures and order by valid workflow. Do not execute stripe-verify.ts until import location/environment/cleanup intent is established; its201 assertion alone is insufficient evidence. Test data/Stripe runs must stay separate from production.

### Delivery acceptance for the future frontend

All role screens connect to real APIs with exact contracts; no fake persisted records/payment states; no backend changes; no credential leakage; build/type checks and meaningful frontend tests pass; APP_BASE_URL/CORS/API origin/currency and unresolved gaps are documented. Known backend limitations remain visible in handoff so production readiness is not implied by UI completion alone.

## 25. UNKNOWN / NEEDS VERIFICATION


Only observed missing/inconsistent facts are included. These are integration decisions/evidence gaps; no backend repair recommendation or modification is performed.

| Item | Evidence / classification | Required understanding for frontend |
|---|---|---|
| Exact Verify.ts absent | working filename search + archive inventory; actual stripe-verify.ts exists | If a different intended Verify.ts exists outside supplied project, its behavior is not covered |
| Utility location/import mismatch | ../stripe-verify.ts:2–5 relative ./src; no root src | Past execution location UNKNOWN; current placement not directly validated by backend build |
| Verification coverage | script201 assertion only, other values logged; no saved run output | No proof here of full payment completion/failed events/reviews/concurrency |
| Postman observed response coverage | all73 have no saved response;8 storage scripts, no assertions | Expected DTO/status source is backend; live request outcomes UNKNOWN |
| Variable resolution | environment empty variables overlap collection script targets | Supplied selected environment can shadow stored tokens/IDs; actual user's current local values UNKNOWN |
| Refresh/fixture sequencing | shared refreshToken, no refresh pair writer; delete/reject/etc in linear order | Collection is endpoint catalog, not turnkey valid E2E run |
| Production config | origin/CORS/APP_BASE_URL/currency/fee/token expiry only defaults inspected | Deployment values and frontend return host UNKNOWN; no secret values needed in report |
| Current DB/migrations/seed/Stripe mode | files only, no live calls; utility checks secret existence not mode | No actual account IDs/current categories/payment mode inferred |
| Admin provisioning | register disallowsADMIN; seed categories only | Supported operational provision path NOT FOUND |
| Duration unit | schema/validator int<=1440; examples60 | Minutes convention plausible but not established by explicit code unit/check |
| Released slot | retains Booking.slotId unique/FK after isBooked=false | Rebooking409/hard-delete500 possible; existing slot edit can alter history |
| Checkout retry/failure/cancel | sessionId overwritten; failed handler looks for intentId; cancellation does not expire session | Authoritative reconciliation can stayPENDING/error; recovery API NOT FOUND |
| Concurrent state/overlap | pre-read guards then unconditioned updates; no overlap exclusion constraint | Race behavior needs runtime verification, frontend not a concurrency lock |
| Stored rating | no review mutation updates provider rating/totalReviews | Live aggregate differs; stored-rating provider sort can remain stale |
| Review delete/recreate | unique bookingId survives soft delete | No restore/review replacement path; absent own review not proof of eligibility |
| Token rotation uniqueness | no jti/random claims; identical same-second tokens possible | Distinct-string/replay assumptions cannot be guaranteed from code |
| Return context lookup | no sessionId→booking API; cancel URL has no ID | Frontend must retain bookingId or recover through own history |
| Public visibility consistency | public reviews no parent guard; provider count unfiltered | Hidden parent reviews/counts may remain visible; intended policy unspecified |
| Missing integrations | no upload/notification/realtime/refund/reschedule/map/payout/reset APIs | Do not invent UI-backed functionality |
| Docs discrepancies | seed-service wording, future slot wording, ignored total wording, response-envelope claims, QA assertions | Use source semantics in §3 and documented edge cases |

### Analysis verification record

Source audit covers the earlier full route/controller/service/schema inspection plus this turn's complete raw Postman JSON/script/variable and43-line utility inspection; backend tracked source has no diff.66 routes and73 examples are cross-checked by normalized method/path, not request-name guessing. Archive Postman bytes equal working JSON. Page/API map covers all66 endpoints and every P record identifies frontend relevance. No backend/utility/Postman execution with side effects or frontend code generation occurred.

The previous source-only TypeScript check `tsc --noEmit` passed; it excludes the root verification utility and proves no live DB/payment behavior. Final document QA: **PASS** — 25 sections,73 Postman records,66 individual endpoint contracts,31 page contracts, all local source links resolved. Read-only actual Zod validation parsed20 request bodies and21 query contracts across73 examples with0 failures; credential placeholders replaced by safe schema-only dummy strings, not real credentials. This checks input syntax only, not resource existence/auth/workflow or saved responses. Backend/Postman/config/utility fingerprint comparison:84 inputs unchanged. No API or DB called.
