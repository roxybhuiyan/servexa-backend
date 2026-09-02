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

Servexa is API-first; a frontend is not required for this assignment. JWT authentication, RBAC, and payment integration will be added later. Redis is optional and will be evaluated later.
