import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

import config from '../config/index.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const adapter = new PrismaPg(config.databaseUrl);
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
