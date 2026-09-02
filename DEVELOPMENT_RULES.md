# Development Rules

- TypeScript strict mode.
- No `any` unless explicitly justified.
- No hardcoded secrets.
- Never commit `.env`.
- Validate all client input on the server using Zod.
- Use Prisma for database access.
- Use async/await.
- Use centralized error handling.
- Use versioned API routes.
- Follow consistent API response format.
- Do not trust client-provided calculated totals.
- Do not expose password hashes or sensitive authentication data.
- Avoid unnecessary dependencies.
- Do not make unrelated refactors.
- Do not change the approved architecture without explicit approval.
- Business logic belongs in service layer, not route handlers.
- Controllers should remain thin.
- Database queries should be efficient and selective.
