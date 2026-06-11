import { runInTransaction, prisma } from '../../../../infrastructure/prisma.js';
import { logEvent } from '../../index.js';
import { als } from '../../../../infrastructure/als.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';

setupTestDB();

describe('Audit Infrastructure Integration', () => {
  describe('Metadata Sanitization & Persistence', () => {
    it('should recursively redact sensitive fields from metadata and persist', async () => {
      const payload = {
        event: 'auth.login',
        targetType: 'User',
        targetId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'EXECUTE',
        metadata: {
          ip: '127.0.0.1',
          user: {
            password: 'my-super-secret-password',
            refreshToken: 'refresh-token-123',
            safeData: 'hello',
          },
        },
      };

      const auditLog = await logEvent(payload);

      expect(auditLog).toBeDefined();
      expect(auditLog.event).toBe('auth.login');
      // Verify redaction without using snapshots
      expect(auditLog.metadata.user.password).toBe('[REDACTED]');
      expect(auditLog.metadata.user.refreshToken).toBe('[REDACTED]');
      expect(auditLog.metadata.user.safeData).toBe('hello');
      expect(auditLog.metadata.ip).toBe('127.0.0.1');
    });
  });

  describe('Transactional Consistency Guarantees', () => {
    it('should rollback audit records if the parent transaction fails (business failure simulation)', async () => {
      let capturedError;
      try {
        await runInTransaction(async (tx) => {
          // Write an audit log successfully inside the transaction
          await logEvent(
            {
              event: 'users.updated',
              targetType: 'User',
              targetId: '660e8400-e29b-41d4-a716-446655440000',
              action: 'UPDATE',
            },
            tx,
          );

          // Simulate a critical business failure or database constraint violation occurring AFTER the audit log
          throw new Error('Business logic failed constraints!');
        });
      } catch (error) {
        capturedError = error;
      }
      expect(capturedError.message).toBe('Business logic failed constraints!');

      // Assert that the transaction cleanly rolled back the audit record

      const count = await prisma.auditLog.count();

      expect(count).toBe(0); // Proves transactional isolation is perfect
    });
  });

  describe('ALS Context Propagation', () => {
    it('should successfully extract reqId and actorId from AsyncLocalStorage without HTTP objects', async () => {
      const store = {
        reqId: 'req-uuid-999',
        userId: '770e8400-e29b-41d4-a716-446655440000',
      };

      await als.run(store, async () => {
        const auditLog = await logEvent({
          event: 'notes.created',
          targetType: 'Note',
          targetId: '880e8400-e29b-41d4-a716-446655440000',
          action: 'CREATE',
        });

        // The service should have pulled these purely from context
        expect(auditLog.reqId).toBe('req-uuid-999');
        expect(auditLog.actorId).toBe('770e8400-e29b-41d4-a716-446655440000');
      });
    });
  });
});
