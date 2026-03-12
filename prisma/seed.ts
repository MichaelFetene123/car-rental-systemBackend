import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleType } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL!;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding roles...');

  await prisma.role.createMany({
    data: [
      { name: 'admin', type: RoleType.admin },
      { name: 'stuff', type: RoleType.stuff },
      { name: 'user', type: RoleType.user },
    ],
    skipDuplicates: true,
  });

  console.log('Roles seeded successfully');

  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminPassword = process.env.ADMIN_PASSWORD!;
  const adminFullName = process.env.ADMIN_FULL_NAME!;

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    await prisma.user.create({
      data: {
        full_name: adminFullName,
        email: adminEmail,
        password: hashedPassword,
        userRoles: {
          create: {
            role: {
              connect: { id: adminRole!.id },
            },
          },
        },
      },
    });

    console.log('Admin user created');
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
