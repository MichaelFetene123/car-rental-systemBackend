import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleType } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { PermissionType } from '../src/common/enums/permission.enum';

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

  console.log('Seeding permissions...');

  await prisma.permission.createMany({
    data: [
      {
        code: PermissionType.VIEW_DASHBOARD,
        name: 'View Dashboard',
        category: 'dashboard',
      },
      {
        code: PermissionType.MANAGE_CARS,
        name: 'Manage Cars',
        category: 'cars',
      },
      {
        code: PermissionType.VIEW_CARS,
        name: 'View Cars',
        category: 'cars',
      },
      {
        code: PermissionType.MANAGE_BOOKINGS,
        name: 'Manage Bookings',
        category: 'bookings',
      },
      {
        code: PermissionType.VIEW_BOOKINGS,
        name: 'View Bookings',
        category: 'bookings',
      },
      {
        code: PermissionType.CANCEL_BOOKINGS,
        name: 'Cancel Bookings',
        category: 'bookings',
      },
      {
        code: PermissionType.MANAGE_USERS,
        name: 'Manage Users',
        category: 'users',
      },
      {
        code: PermissionType.VIEW_USERS,
        name: 'View Users',
        category: 'users',
      },
      {
        code: PermissionType.MANAGE_PAYMENTS,
        name: 'Manage Payments',
        category: 'payments',
      },
      {
        code: PermissionType.VIEW_PAYMENTS,
        name: 'View Payments',
        category: 'payments',
      },
      {
        code: PermissionType.MANAGE_LOCATIONS,
        name: 'Manage Locations',
        category: 'locations',
      },
      {
        code: PermissionType.MANAGE_ROLES,
        name: 'Manage Roles',
        category: 'roles',
      },
      {
        code: PermissionType.MANAGE_NOTIFICATIONS,
        name: 'Manage Notifications',
        category: 'notifications',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Permissions seeded successfully');

  const rolePermissionMap: Record<RoleType, PermissionType[]> = {
    admin: Object.values(PermissionType),
    stuff: [
      PermissionType.VIEW_DASHBOARD,
      PermissionType.VIEW_CARS,
      PermissionType.MANAGE_BOOKINGS,
      PermissionType.CANCEL_BOOKINGS,
      PermissionType.VIEW_BOOKINGS,
      PermissionType.VIEW_USERS,
      PermissionType.VIEW_PAYMENTS,
      PermissionType.MANAGE_LOCATIONS,
      PermissionType.MANAGE_NOTIFICATIONS,
    ],
    user: [PermissionType.VIEW_CARS, PermissionType.VIEW_BOOKINGS],
  };

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
  ]);

  const roleIdByType = new Map(roles.map((role) => [role.type, role.id]));
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  const rolePermissionsToCreate = Object.entries(rolePermissionMap).flatMap(
    ([roleType, permissionCodes]) => {
      const roleId = roleIdByType.get(roleType as RoleType);

      if (!roleId) return [];

      return permissionCodes
        .map((code) => {
          const permissionId = permissionIdByCode.get(code);
          if (!permissionId) return null;

          return {
            roleId,
            permissionId,
          };
        })
        .filter((item): item is { roleId: string; permissionId: string } =>
          Boolean(item),
        );
    },
  );

  if (rolePermissionsToCreate.length > 0) {
    await prisma.rolePermission.createMany({
      data: rolePermissionsToCreate,
      skipDuplicates: true,
    });
  }

  console.log('Role-permission mapping seeded successfully');


  
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
