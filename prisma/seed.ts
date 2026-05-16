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

  console.log('Seeding locations...');

  const locationsToSeed = [
    {
      name: 'Bole Branch',
      address: 'Bole Road, Woreda 3',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      zipCode: '1000',
      phone: '+251911000001',
      email: 'bole@carrental.com',
      openingHours: 'Mon-Sat 8:00-20:00',
    },
    {
      name: 'Kazanchis Branch',
      address: 'Kazanchis Business District',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      zipCode: '1000',
      phone: '+251911000002',
      email: 'kazanchis@carrental.com',
      openingHours: 'Mon-Sat 8:00-20:00',
    },
    {
      name: 'CMC Branch',
      address: 'CMC Ring Road',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      zipCode: '1000',
      phone: '+251911000003',
      email: 'cmc@carrental.com',
      openingHours: 'Mon-Sat 8:00-20:00',
    },
    {
      name: 'Gullele Branch',
      address: 'Gullele Subcity, Woreda 8',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      zipCode: '1000',
      phone: '+251911000004',
      email: 'gullele@carrental.com',
      openingHours: 'Mon-Sat 8:00-20:00',
    },
    {
      name: 'Mexico Branch',
      address: 'mexico square, Woreda 3',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      zipCode: '1000',
      phone: '+251911000004',
      email: 'mexico@carrental.com',
      openingHours: 'Mon-Sat 8:00-20:00',
    },
  ];

  for (const location of locationsToSeed) {
    await prisma.location.upsert({
      where: {
        name_city_state: {
          name: location.name,
          city: location.city,
          state: location.state,
        },
      },
      update: {
        address: location.address,
        zipCode: location.zipCode,
        phone: location.phone,
        email: location.email,
        openingHours: location.openingHours,
        isActive: true,
      },
      create: {
        ...location,
        isActive: true,
      },
    });
  }

  console.log('Locations seeded successfully');

  console.log('Seeding car categories...');

  const categoriesToSeed = [
    { name: 'SUV', description: 'Sport utility vehicles' },
    { name: 'Sedan', description: 'Comfortable city and family cars' },
    { name: 'Hatchback', description: 'Compact and fuel efficient cars' },
    { name: 'Luxury', description: 'Premium class vehicles' },
  ];

  for (const category of categoriesToSeed) {
    await prisma.carCategory.upsert({
      where: { name: category.name },
      update: {
        description: category.description,
        isActive: true,
      },
      create: {
        ...category,
        isActive: true,
      },
    });
  }

  console.log('Car categories seeded successfully');

  console.log('Seeding cars...');

  // To create cars, we need to get the IDs of the seeded locations and categories first. We will use upsert for cars as well to avoid duplicates if the seed script is run multiple times.

  const [seededLocations, seededCategories] = await Promise.all([
    prisma.location.findMany(),
    prisma.carCategory.findMany(),
  ]);

  const locationIdByName = new Map(
    seededLocations.map((location) => [location.name, location.id]),
  );
  const categoryIdByName = new Map(
    seededCategories.map((category) => [category.name, category.id]),
  );

  const carsToSeed = [
    {
      name: 'Toyota Corolla 2022',
      year: 2022,
      seats: 5,
      fuelType: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 68,
      imageUrl: 'https://images.unsplash.com/photo-1549924231-f129b911e442',
      description: 'Reliable sedan for everyday trips.',
      categoryName: 'Sedan',
      locationName: 'Bole Branch',
    },
    {
      name: 'Hyundai Elantra 2021',
      year: 2021,
      seats: 5,
      fuelType: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 64,
      imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d',
      description: 'Comfort sedan with smooth handling.',
      categoryName: 'Sedan',
      locationName: 'Kazanchis Branch',
    },
    {
      name: 'Kia Picanto 2020',
      year: 2020,
      seats: 4,
      fuelType: 'Petrol',
      transmission: 'Manual',
      pricePerDay: 42,
      imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      description: 'Compact hatchback for city rides.',
      categoryName: 'Hatchback',
      locationName: 'CMC Branch',
    },
    {
      name: 'Suzuki Swift 2021',
      year: 2021,
      seats: 5,
      fuelType: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 46,
      imageUrl: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f',
      description: 'Efficient hatchback with modern interior.',
      categoryName: 'Hatchback',
      locationName: 'Bole Branch',
    },
    {
      name: 'Toyota RAV4 2023',
      year: 2023,
      seats: 5,
      fuelType: 'Hybrid',
      transmission: 'Automatic',
      pricePerDay: 89,
      imageUrl: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98',
      description: 'Spacious SUV for family and business travel.',
      categoryName: 'SUV',
      locationName: 'Kazanchis Branch',
    },
    {
      name: 'Nissan X-Trail 2022',
      year: 2022,
      seats: 7,
      fuelType: 'Diesel',
      transmission: 'Automatic',
      pricePerDay: 95,
      imageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8',
      description: 'Seven-seater SUV with extra cargo space.',
      categoryName: 'SUV',
      locationName: 'CMC Branch',
    },
    {
      name: 'Mercedes C-Class 2022',
      year: 2022,
      seats: 5,
      fuelType: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 135,
      imageUrl:
        'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80',
      description: 'Luxury sedan with premium comfort.',
      categoryName: 'Luxury',
      locationName: 'Bole Branch',
    },
    {
      name: 'BMW X5 2023',
      year: 2023,
      seats: 5,
      fuelType: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 150,
      imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e',
      description: 'Powerful premium SUV for long drives.',
      categoryName: 'Luxury',
      locationName: 'Kazanchis Branch',
    },
    {
      name: 'Tesla Model 3 2024',
      year: 2024,
      seats: 5,
      fuelType: 'Electric',
      transmission: 'Automatic',
      pricePerDay: 140,
      imageUrl: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982',
      description: 'Modern electric sedan with autopilot features.',
      categoryName: 'Luxury',
      locationName: 'CMC Branch',
    },
  ];

  const existingCars = await prisma.car.findMany({
    select: { name: true },
  });
  const existingCarNames = new Set(existingCars.map((car) => car.name));

  const carsToInsert = carsToSeed
    .filter((car) => !existingCarNames.has(car.name))
    .map((car) => ({
      name: car.name,
      year: car.year,
      seats: car.seats,
      fuelType: car.fuelType,
      transmission: car.transmission,
      pricePerDay: car.pricePerDay,
      status: 'available' as const,
      imageUrl: car.imageUrl,
      description: car.description,
      categoryId: categoryIdByName.get(car.categoryName),
      homeLocationId: locationIdByName.get(car.locationName),
    }));

  if (carsToInsert.length > 0) {
    await prisma.car.createMany({
      data: carsToInsert,
    });
  }

  console.log(
    `Cars seeded successfully. Inserted ${carsToInsert.length} cars.`,
  );

  // 11111111111111111111111111111111111111111111111111111111111111111111111111111

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

  console.log('Seeding expired booking demo data...');

  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const demoCar = await prisma.car.findFirst({
    select: { id: true, name: true },
  });

  if (!adminUser || !demoCar) {
    console.log('Skipping expired booking demo data (missing user or car).');
    return;
  }

  const demoBookingCode = 'CRON-EXPIRE-DEMO';
  const demoInvoiceNumber = 'INV-CRON-EXPIRE-DEMO';

  const existingDemoBooking = await prisma.booking.findUnique({
    where: { bookingCode: demoBookingCode },
  });

  const booking =
    existingDemoBooking ??
    (await prisma.booking.create({
      data: {
        bookingCode: demoBookingCode,
        userId: adminUser.id,
        carId: demoCar.id,
        pickupAt: new Date(Date.now() + 60 * 60 * 1000),
        returnAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: 'pending',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
        totalAmount: 100,
        carNameSnapshot: demoCar.name,
      },
    }));

  const existingDemoPayment = await prisma.payment.findUnique({
    where: { invoiceNumber: demoInvoiceNumber },
  });

  if (!existingDemoPayment) {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        invoiceNumber: demoInvoiceNumber,
        amount: 100,
        method: 'cash',
        status: 'pending',
      },
    });
  }

  console.log('Expired booking demo data seeded.');
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
