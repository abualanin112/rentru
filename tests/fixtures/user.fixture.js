import { faker } from '@faker-js/faker';
import { prisma } from '../../src/infrastructure/prisma.js';
import crypto from 'node:crypto';

const createCuid2 = () => crypto.randomUUID();

const userOne = {
  id: createCuid2(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email().toLowerCase(),
  roleName: 'standard_user',
  isActive: true,
};

const userTwo = {
  id: createCuid2(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email().toLowerCase(),
  roleName: 'standard_user',
  isActive: true,
};

const admin = {
  id: createCuid2(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email().toLowerCase(),
  roleName: 'super_admin',
  isActive: true,
};

const insertUsers = async (users) => {
  let time = Date.now();
  const data = [];
  for (const user of users) {
    data.push({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: new Date(time),
      updatedAt: new Date(time),
    });
    time -= 1000;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Insert base users
    await tx.user.createMany({
      data,
      skipDuplicates: true,
    });

    // 2. Ensure Wildcard & Super Admin Role
    const wildcard = await tx.permission.upsert({
      where: { action_subject_scope: { action: '*', subject: '*', scope: '*' } },
      update: {},
      create: { action: '*', subject: '*', scope: '*', group: 'System' },
    });
    const superAdminRole = await tx.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: { name: 'super_admin', level: 100 },
    });
    await tx.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: wildcard.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: wildcard.id },
    });

    // 3. Ensure Standard User Role and Permissions
    const standardRole = await tx.role.upsert({
      where: { name: 'standard_user' },
      update: {},
      create: { name: 'standard_user', level: 10 },
    });

    const userPerms = [
      { action: 'read', subject: 'notes', scope: 'own', group: 'Operations' },
      { action: 'create', subject: 'notes', scope: 'own', group: 'Operations' },
      { action: 'update', subject: 'notes', scope: 'own', group: 'Operations' },
      { action: 'delete', subject: 'notes', scope: 'own', group: 'Operations' },
      { action: 'read', subject: 'users', scope: 'own', group: 'IAM' },
      { action: 'update', subject: 'users', scope: 'own', group: 'IAM' },
      { action: 'delete', subject: 'users', scope: 'own', group: 'IAM' },
    ];

    for (const p of userPerms) {
      const perm = await tx.permission.upsert({
        where: { action_subject_scope: { action: p.action, subject: p.subject, scope: p.scope } },
        update: {},
        create: { action: p.action, subject: p.subject, scope: p.scope, group: p.group },
      });
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: standardRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: standardRole.id, permissionId: perm.id },
      });
    }

    // 4. Assign Roles based on roleName property
    for (const user of users) {
      const targetRole = user.roleName === 'super_admin' ? superAdminRole : standardRole;
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: targetRole.id } },
        update: {},
        create: { userId: user.id, roleId: targetRole.id, assignedBy: 'test-fixture' },
      });
    }
  });
};

export { userOne, userTwo, admin, insertUsers };
