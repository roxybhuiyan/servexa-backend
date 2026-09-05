import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma/client.js';

import config from '../config/index.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma.');
}






const pool = globalForPrisma.pool ?? new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
const adapter = new PrismaPg(pool, { disposeExternalPool: true });
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  transactionOptions: {

    
    // Neon may need longer than Prisma's 2s default to acquire a pooled connection.
    // Keep the transaction atomic while allowing the pg pool's 10s acquisition window.
    maxWait: 15_000,
    timeout: 30_000,
  },
});

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export default prisma;
