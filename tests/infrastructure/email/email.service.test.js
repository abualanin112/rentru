import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailService } from '../../../src/infrastructure/email/index.js';
import * as mailer from '../../../src/infrastructure/email/mailer.js';
import { config } from '../../../src/infrastructure/config.js';

// Mock the internal transporter to prevent real emails from being sent
vi.mock('../../../src/infrastructure/email/mailer.js', () => ({
  sendMail: vi.fn(),
  verifySmtpConnection: vi.fn(),
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send an email with the correct subject and template', async () => {
      mailer.sendMail.mockResolvedValueOnce(true);

      const to = 'test@example.com';
      const token = 'reset-token-123';

      const result = await emailService.sendPasswordResetEmail(to, token);

      expect(result).toBe(true);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);

      const callArgs = mailer.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(to);
      expect(callArgs.subject).toBe('Reset Your Password - Rentru');
      expect(callArgs.html).toContain(token);
      expect(callArgs.from).toBe(config.email.from);
    });

    it('should swallow errors and return false if sending fails', async () => {
      mailer.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      const to = 'test@example.com';
      const token = 'reset-token-123';

      const result = await emailService.sendPasswordResetEmail(to, token);

      expect(result).toBe(false);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send a verification email', async () => {
      mailer.sendMail.mockResolvedValueOnce(true);

      const to = 'test@example.com';
      const token = 'verify-token-123';

      const result = await emailService.sendVerificationEmail(to, token);

      expect(result).toBe(true);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);

      const callArgs = mailer.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(to);
      expect(callArgs.subject).toBe('Verify Your Email - Rentru');
      expect(callArgs.html).toContain(token);
    });
  });

  describe('sendInviteEmail', () => {
    it('should send an invite email with inviter name', async () => {
      mailer.sendMail.mockResolvedValueOnce(true);

      const to = 'invitee@example.com';
      const token = 'invite-token-123';
      const inviterName = 'John Doe';

      const result = await emailService.sendInviteEmail(to, token, inviterName);

      expect(result).toBe(true);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);

      const callArgs = mailer.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe(to);
      expect(callArgs.subject).toBe('John Doe has invited you to Rentru');
      expect(callArgs.html).toContain(token);
      expect(callArgs.html).toContain('John Doe');
    });
  });
});
