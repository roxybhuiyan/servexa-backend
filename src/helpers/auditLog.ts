import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

type AuditClient = Pick<typeof prisma, 'auditLog'>;

type AuditLogInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export const createAuditLog = async (client: AuditClient, input: AuditLogInput): Promise<void> => {
  const toJson = (value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined =>
    value ? (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue) : undefined;

  await client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldData: toJson(input.oldData),
      newData: toJson(input.newData),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
};
