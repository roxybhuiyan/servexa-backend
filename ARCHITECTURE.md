# Architecture

```
Client / API consumer
        ↓
Express.js
        ↓
Routes
        ↓
Validation
        ↓
Controllers
        ↓
Services
        ↓
Prisma ORM
        ↓
PostgreSQL / Neon
```

Servexa is API-first; a frontend is not required for this assignment. It uses
JWT authentication, route-level RBAC, Prisma/PostgreSQL persistence, and Stripe
Checkout with signed webhooks. Redis remains optional and has not been added.

In production, Render supplies one trusted reverse-proxy hop. Express therefore
uses `trust proxy = 1` only when `NODE_ENV=production`, allowing IP-based rate
limiting to use the forwarded client IP without trusting arbitrary proxy chains.
Browser CORS is controlled through the comma-separated `CORS_ORIGINS` allowlist;
requests without an `Origin` header, including Stripe webhooks, are permitted.
