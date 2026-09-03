import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

import config from '../config/index.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const runtimeUrl = new URL(config.databaseUrl);
runtimeUrl.searchParams.set('connect_timeout', '30');

const adapter = new PrismaPg(runtimeUrl.toString());
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
