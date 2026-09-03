import { createAuditLog } from '../../../helpers/auditLog.js';
import prisma from '../../../lib/prisma.js';
import AppError from '../../errors/AppError.js';

type AuditContext = { ipAddress?: string; userAgent?: string };
type CategoryPayload = { name?: string; slug?: string; description?: string | null };

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const uniqueCategorySlug = async (name: string, requestedSlug?: string, excludeId?: string) => {
  const base = requestedSlug ?? slugify(name);
  const existing = await prisma.category.findFirst({
    where: { slug: base, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new AppError(409, 'A category with this slug already exists');

  return base;
};

export const getPublicCategories = async () =>
  prisma.category.findMany({
    where: { deletedAt: null },
    select: categorySelect,
    orderBy: { name: 'asc' },
  });

export const getAdminCategories = async (query: {
  page: number;
  limit: number;
  search?: string;
}) => {
  const where = {
    deletedAt: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };
  const [total, data] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      select: categorySelect,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
    data,
  };
};

export const createCategory = async (
  actorId: string,
  payload: Required<Pick<CategoryPayload, 'name'>> & CategoryPayload,
  context: AuditContext,
) => {
  const slug = await uniqueCategorySlug(payload.name, payload.slug);
  const duplicate = await prisma.category.findFirst({
    where: { name: payload.name },
    select: { id: true },
  });
  if (duplicate) throw new AppError(409, 'A category with this name already exists');

  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.create({
      data: { name: payload.name, slug, description: payload.description },
      select: categorySelect,
    });
    await createAuditLog(transaction, {
      userId: actorId,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      newData: { name: category.name, slug: category.slug },
      ...context,
    });
    return category;
  });
};

export const updateCategory = async (
  actorId: string,
  categoryId: string,
  payload: CategoryPayload,
  context: AuditContext,
) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } });
  if (!category) throw new AppError(404, 'Category not found');

  const nextName = payload.name ?? category.name;
  const nextSlug = payload.slug ?? (payload.name ? slugify(payload.name) : category.slug);
  if (nextSlug !== category.slug) await uniqueCategorySlug(nextName, nextSlug, category.id);
  if (nextName !== category.name) {
    const duplicate = await prisma.category.findFirst({
      where: { name: nextName, id: { not: category.id } },
    });
    if (duplicate) throw new AppError(409, 'A category with this name already exists');
  }

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.category.update({
      where: { id: categoryId },
      data: { ...payload, slug: nextSlug },
      select: categorySelect,
    });
    await createAuditLog(transaction, {
      userId: actorId,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: categoryId,
      oldData: { name: category.name, slug: category.slug, description: category.description },
      newData: { name: updated.name, slug: updated.slug, description: updated.description },
      ...context,
    });
    return updated;
  });
};

export const softDeleteCategory = async (
  actorId: string,
  categoryId: string,
  context: AuditContext,
) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } });
  if (!category) throw new AppError(404, 'Category not found');

  const activeServiceCount = await prisma.service.count({
    where: { categoryId, deletedAt: null, status: 'ACTIVE' },
  });
  if (activeServiceCount > 0) {
    throw new AppError(409, 'Cannot delete a category with active services');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.category.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
    await createAuditLog(transaction, {
      userId: actorId,
      action: 'CATEGORY_SOFT_DELETED',
      entityType: 'Category',
      entityId: categoryId,
      oldData: { name: category.name, slug: category.slug, deletedAt: null },
      newData: { deleted: true },
      ...context,
    });
  });
};
