import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../src/infrastructure/logger.js';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting RBAC Bootstrap...');

  await prisma.$transaction(async (tx) => {
    // 1. Create the global wildcard permission
    const wildcardPermission = await tx.permission.upsert({
      where: {
        action_resource_scope: {
          action: '*',
          resource: '*',
          scope: '*',
        },
      },
      update: {},
      create: {
        action: '*',
        resource: '*',
        scope: '*',
        description: 'Global Wildcard - Grants all permissions across the system.',
      },
    });
    logger.info(`Wildcard permission ensured: ${wildcardPermission.id}`);

    // 2. Create the super_admin role (Level 100)
    const superAdminRole = await tx.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: {
        name: 'super_admin',
        description: 'System Administrator with unrestricted access.',
        level: 100,
        isSystem: true,
      },
    });
    logger.info(`Super admin role ensured: ${superAdminRole.id}`);

    // 3. Link Wildcard Permission to Super Admin Role
    await tx.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: wildcardPermission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: wildcardPermission.id,
      },
    });
    logger.info('RolePermission link established.');

    // 4. Find or Create the Default Admin User
    // Assuming a default admin email is provided via ENV or we find the first legacy 'admin'
    let adminUser = await tx.user.findFirst({
      where: { role: 'admin' },
    });

    if (!adminUser) {
      logger.warn('No legacy admin user found. Creating a default admin user...');
      const hashedPassword = await bcrypt.hash('ChangeMe123!', 10);
      adminUser = await tx.user.create({
        data: {
          name: 'System Admin',
          email: 'admin@system.local',
          password: hashedPassword,
          role: 'admin',
          isEmailVerified: true,
        },
      });
    }

    // 5. Assign the super_admin role to the Admin User
    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
        assignedBy: 'system-bootstrap',
      },
    });
    logger.info(`Bootstrap complete! User ${adminUser.email} is now a super_admin.`);
  });
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Bootstrap failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
