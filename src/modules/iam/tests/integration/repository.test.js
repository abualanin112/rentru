import { describe, test, expect } from 'vitest';
import { create as createUser, findByEmail } from '../../repositories/user.repository.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';

setupTestDB();

describe('Repositories Layer (Integration)', () => {
  describe('User Repository', () => {
    test('should insert user with correct data', async () => {
      const userData = { firstName: 'Test', lastName: 'User', email: 'test@example.com' };
      const user = await createUser(userData, prisma);
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    test('should find user by email', async () => {
      const userData = { firstName: 'Test2', lastName: 'User2', email: 'test2@example.com' };
      await createUser(userData, prisma);

      const user = await findByEmail('test2@example.com', prisma);
      expect(user.email).toBe('test2@example.com');
    });
  });
});
