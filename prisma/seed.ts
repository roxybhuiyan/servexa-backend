import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error('DIRECT_URL is required to run Prisma seeds.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(directUrl) });

const seedCategories = [
  { name: 'Home Repair', slug: 'home-repair' },
  { name: 'Cleaning', slug: 'cleaning' },
  { name: 'Beauty', slug: 'beauty' },
  { name: 'Education', slug: 'education' },
  { name: 'Professional', slug: 'professional' },
  { name: 'Automotive', slug: 'automotive' },
] as const;

// These are catalog definitions for future provider-owned service listings.
// Service records are not seeded without real provider profiles.
const initialServiceDefinitions = [
  'AC Repair', 'AC Servicing', 'Plumbing', 'Electrician',
  'Home Cleaning', 'Deep Cleaning', 'Sofa Cleaning', 'Office Cleaning',
  'Home Haircut', 'Makeup Artist', 'Facial', 'Manicure',
  'Math Tutor', 'English Tutor', 'IELTS Tutor', 'Programming Tutor',
  'Web Development', 'Graphic Design', 'SEO', 'Photography',
  'Car Wash', 'Car Detailing', 'Car Repair', 'Bike Repair',
] as const;

const seed = async (): Promise<void> => {
  for (const category of seedCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, deletedAt: null },
      create: category,
    });
  }

  console.info(`Seeded ${seedCategories.length} categories.`);
  console.info(
    `${initialServiceDefinitions.length} service definitions are reserved for future provider-owned listings.`,
  );
};

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
