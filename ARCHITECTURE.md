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
