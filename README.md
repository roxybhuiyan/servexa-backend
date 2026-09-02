# Servexa Backend

Servexa is an on-demand service booking marketplace. This repository contains its API-first backend foundation.

## Technology stack

- Node.js, TypeScript, and Express.js
- PostgreSQL with Prisma ORM (ready for future setup)
- Zod, JWT, bcryptjs
- ESLint and Prettier

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in the required values. Never commit `.env`.
3. Start development: `npm run dev`

## Scripts

- `npm run dev` — run the TypeScript development server with file watching
- `npm run build` — compile TypeScript to `dist`
- `npm run start` — run the compiled production server
- `npm run lint` — lint the project
- `npm run format` — format files with Prettier

## Health endpoint

`GET /health` returns the application health status.

## Production

Build with `npm run build`, then start the compiled server with `npm run start`.
