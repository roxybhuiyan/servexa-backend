import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

const migrationUrl = new URL(env('DATABASE_URL'));
// Neon can take longer than Prisma's default connection window to wake a pooled endpoint.
migrationUrl.searchParams.set('connect_timeout', '30');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl.toString(),
  },
});
