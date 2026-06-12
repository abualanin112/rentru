import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError } from '../../../../shared/ApiError.js';
import * as userService from '../../services/user.service.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, userOne, admin } from '../../../../../tests/fixtures/user.fixture.js';

setupTestDB();

describe('User Service (Integration)', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
  });

  describe('getMe', () => {
    it('should return user if found', async () => {
      const result = await userService.getMe(userOne.id);
      expect(result).toBeDefined();
      expect(result.id).toBe(userOne.id);
      expect(result.email).toBe(userOne.email);
    });

    it('should throw NOT_FOUND if user does not exist', async () => {
      const crypto = await import('node:crypto');
      await expect(userService.getMe(crypto.randomUUID())).rejects.toThrow(ApiError);
    });
  });

  describe('suspendUser', () => {
    it('should throw error if actor tries to suspend themselves', async () => {
      await expect(userService.suspendUser(admin.id, admin.id)).rejects.toThrow(ApiError);
    });

    it('should suspend user and modify DB state', async () => {
      await userService.suspendUser(admin.id, userOne.id);

      const suspendedUser = await prisma.user.findUnique({ where: { id: userOne.id } });
      expect(suspendedUser.isActive).toBe(false);
    });

    it('should throw error if user is already suspended', async () => {
      await userService.suspendUser(admin.id, userOne.id); // Suspend first
      await expect(userService.suspendUser(admin.id, userOne.id)).rejects.toThrow(ApiError);
    });
  });

  describe('archiveUser', () => {
    it('should throw error if actor tries to archive themselves', async () => {
      await expect(userService.archiveUser(admin.id, admin.id)).rejects.toThrow(ApiError);
    });

    it('should archive user (soft delete means findUnique returns null)', async () => {
      await userService.archiveUser(admin.id, userOne.id);

      // Silent Guardian filters out deletedAt != null
      const archivedUser = await prisma.user.findUnique({ where: { id: userOne.id } });
      expect(archivedUser).toBeNull();
    });
  });
});
