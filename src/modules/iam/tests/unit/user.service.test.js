import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../../../shared/ApiError.js';

// Mock dependencies
vi.mock('../../../../infrastructure/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
  runInTransaction: vi.fn(async (callback) => {
    const tx = {
      user: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };
    return callback(tx);
  }),
}));

vi.mock('../../../audit/index.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../services/session.service.js', () => ({
  destroySession: vi.fn(),
}));

vi.mock('../../services/role.service.js', () => ({
  enforcePrivilegeEscalationGuard: vi.fn(),
}));

vi.mock('../../services/permission.service.js', () => ({
  getMaxRoleLevel: vi.fn().mockResolvedValue(100),
}));

vi.mock('../../../../shared/Paginate.js', () => ({
  paginate: vi.fn(),
}));

// Import the service after mocking
import * as userService from '../../services/user.service.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { destroySession } from '../../services/session.service.js';

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 'user-id', firstName: 'John' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getMe('user-id');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NOT_FOUND if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getMe('non-existent')).rejects.toThrow(ApiError);
    });
  });

  describe('suspendUser', () => {
    it('should throw error if actor tries to suspend themselves', async () => {
      await expect(userService.suspendUser('user-1', 'user-1')).rejects.toThrow(ApiError);
    });

    it('should suspend user and destroy session', async () => {
      const mockUser = { id: 'user-2', isActive: true };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // We mocked runInTransaction, so we can verify destroySession is called
      await userService.suspendUser('admin-1', 'user-2');

      expect(destroySession).toHaveBeenCalledWith('user-2');
    });

    it('should throw error if user is already suspended', async () => {
      const mockUser = { id: 'user-2', isActive: false };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(userService.suspendUser('admin-1', 'user-2')).rejects.toThrow(ApiError);
    });
  });

  describe('archiveUser', () => {
    it('should throw error if actor tries to archive themselves', async () => {
      await expect(userService.archiveUser('user-1', 'user-1')).rejects.toThrow(ApiError);
    });

    it('should archive user and destroy session', async () => {
      const mockUser = { id: 'user-2', isActive: true };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await userService.archiveUser('admin-1', 'user-2');

      expect(destroySession).toHaveBeenCalledWith('user-2');
    });
  });
});
