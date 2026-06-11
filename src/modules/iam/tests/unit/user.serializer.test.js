import { serializeUser, serializeUsers } from '../../user.serializer.js';

describe('User Serializer', () => {
  describe('serializeUser', () => {
    test('should return null when user is null or undefined', () => {
      expect(serializeUser(null)).toBeNull();
      expect(serializeUser(undefined)).toBeNull();
    });

    test('should only return whitelisted fields and strip sensitive or legacy fields', () => {
      const mockRawUser = {
        id: 'user-id-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://avatar.com/123',
        isActive: true,
        deletedAt: null,
        branchId: 'branch-1',
        lastLoginAt: new Date('2026-01-01T00:00:00Z'),
        googleId: '1234567890', // Sensitive field to exclude
        sessions: [], // Sensitive field to exclude
        roles: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        extraUnwantedField: 'should-be-removed',
      };

      const serialized = serializeUser(mockRawUser);

      // Verify whitelisted fields are present and identical
      expect(serialized).toEqual({
        id: 'user-id-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://avatar.com/123',
        isActive: true,
        deletedAt: null,
        branchId: 'branch-1',
        lastLoginAt: mockRawUser.lastLoginAt,
        roles: [],
        createdAt: mockRawUser.createdAt,
        updatedAt: mockRawUser.updatedAt,
      });

      // Explicitly check for omissions
      expect(serialized).not.toHaveProperty('googleId');
      expect(serialized).not.toHaveProperty('sessions');
      expect(serialized).not.toHaveProperty('extraUnwantedField');
    });
  });

  describe('serializeUsers', () => {
    test('should return an empty array if input is not an array', () => {
      expect(serializeUsers(null)).toEqual([]);
      expect(serializeUsers(undefined)).toEqual([]);
      expect(serializeUsers({})).toEqual([]);
      expect(serializeUsers('not-an-array')).toEqual([]);
    });

    test('should map and serialize each user in the array', () => {
      const mockRawUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          avatarUrl: null,
          isActive: true,
          deletedAt: null,
          branchId: 'branch-1',
          lastLoginAt: null,
          roles: [],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          avatarUrl: null,
          isActive: false,
          deletedAt: null,
          branchId: 'branch-1',
          lastLoginAt: null,
          roles: [],
          createdAt: new Date('2026-01-02T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        },
      ];

      const serialized = serializeUsers(mockRawUsers);

      expect(serialized).toHaveLength(2);
      expect(serialized[0]).toEqual({
        id: 'user-1',
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One',
        avatarUrl: null,
        isActive: true,
        deletedAt: null,
        branchId: 'branch-1',
        lastLoginAt: null,
        roles: [],
        createdAt: mockRawUsers[0].createdAt,
        updatedAt: mockRawUsers[0].updatedAt,
      });
      expect(serialized[1]).toEqual({
        id: 'user-2',
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
        avatarUrl: null,
        isActive: false,
        deletedAt: null,
        branchId: 'branch-1',
        lastLoginAt: null,
        roles: [],
        createdAt: mockRawUsers[1].createdAt,
        updatedAt: mockRawUsers[1].updatedAt,
      });
    });
  });
});
