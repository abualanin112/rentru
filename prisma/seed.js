import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (!superAdminEmail) {
    console.error('FATAL ERROR: SUPER_ADMIN_EMAIL environment variable is not defined.');
    process.exit(1);
  }

  const normalizedEmail = superAdminEmail.toLowerCase();

  // 1. Create Super Admin Role
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'System Super Administrator',
      level: 100,
      isSystem: true,
      version: 1,
      permissions: {
        create: [
          {
            permission: {
              connectOrCreate: {
                where: {
                  action_subject_scope: {
                    action: '*',
                    subject: '*',
                    scope: '*',
                  },
                },
                create: {
                  action: '*',
                  subject: '*',
                  scope: '*',
                  group: 'System',
                },
              },
            },
          },
        ],
      },
    },
  });

  // 2. Create Super Admin User (Without googleId, waiting for first SSO login)
  let superAdminUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: 'System',
        lastName: 'Admin',
        isActive: true,
        roles: {
          create: {
            roleId: superAdminRole.id,
            assignedBy: 'system-seed',
          },
        },
      },
    });
    console.log(`Super Admin user created successfully with email: ${normalizedEmail}`);
  } else {
    console.log(`Super Admin user already exists with email: ${normalizedEmail}`);
  }

  // Also create a standard_user role for testing and basic functionality
  await prisma.role.upsert({
    where: { name: 'standard_user' },
    update: {},
    create: {
      name: 'standard_user',
      description: 'Standard System User',
      level: 10,
      isSystem: true,
      version: 1,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
