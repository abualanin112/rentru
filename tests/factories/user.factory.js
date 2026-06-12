import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';

const createCuid2 = () => crypto.randomUUID();

export const buildUser = (overrides = {}) => ({
  id: createCuid2(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email().toLowerCase(),
  roleName: 'standard_user',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
