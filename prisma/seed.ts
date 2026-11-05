import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { signupSchema } from '../src/utils/auth.validation';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set to seed the database');
}

const password = process.env.SEED_USER_PASSWORD;
const passwordValidation = signupSchema.shape.password.safeParse(password);
if (!passwordValidation.success) {
  throw new Error(
    'SEED_USER_PASSWORD must be at least 8 characters and contain uppercase, lowercase, and numeric characters',
  );
}
const seedPassword = passwordValidation.data;
if (typeof seedPassword !== 'string') {
  throw new Error('SEED_USER_PASSWORD must be set');
}

const users = [
  { email: 'alice@example.com', username: 'Alice Example' },
  { email: 'bob@example.com', username: 'Bob Example' },
  { email: 'charlie@example.com', username: 'Charlie Example' },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { username: user.username, password: hashedPassword },
      create: { ...user, password: hashedPassword },
    });
  }

  console.log(`Seeded ${users.length} users.`);
}

main()
  .catch((error: unknown) => {
    console.error('Failed to seed users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });