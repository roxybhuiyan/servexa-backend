# Database Specification

## Models and relationships

- `User` owns an optional `ProviderProfile`, customer bookings, reviews, payments, refresh tokens, and audit logs.
- `ProviderProfile` belongs to one user and owns services, availability slots, and provider bookings.
- `Category` has many provider-owned `Service` records.
- `Service` belongs to a category and provider profile; it has slots, bookings, and reviews.
- `Booking` belongs to a customer, provider profile, service, and unique availability slot. It has at most one payment and review.
- `Payment` belongs to a unique booking and its user. `Review` belongs to a unique booking, customer, and service.
- `RefreshToken` and `AuditLog` belong to users; audit logs may have no user for system events.

## Enums

`UserRole`, `UserStatus`, `ProviderStatus`, `ServiceStatus`, `BookingStatus`, `PaymentStatus`, and `PaymentProvider` represent stable workflow states. Service names remain database data, never enums.

## Indexes and constraints

Unique constraints protect user email, provider profile user ID, category name/slug, service slug, booking slot ID, payment booking ID/transaction ID, and review booking ID. Query indexes support role/status, provider status/city, service provider/category/status/price/creation time, slot lookup, booking lookup, payment status, review lookup, token expiry, and audit-entity lookup.

## Soft deletion

`User`, `ProviderProfile`, `Category`, `Service`, and `Review` use nullable `deletedAt`. Future application queries must exclude soft-deleted records.

## Money and booking integrity

All currency values use PostgreSQL `DECIMAL(12,2)` through Prisma `Decimal`, never floating point. Booking stores price, platform-fee, and total snapshots. `Booking.slotId` is unique, so the database permits only one booking per availability slot; slots also have a unique provider/service/start/end definition.

## Payments and audit logs

Each booking supports one payment record. Payment gateway payloads and audit old/new values use Prisma `Json` fields. Refresh-token storage accepts hashes only (`tokenHash`).

## Seed data

The seed is deterministic and upserts the six confirmed categories. Services are mandatory provider-owned listings, so no synthetic provider accounts or invalid provider-less services are seeded. The 24 approved service names are retained in the seed source as future listing definitions.
