import { config } from '../config.js';
import { logger } from '../logger.js';
import { sendMail } from './mailer.js';
import { resetPasswordTemplate, verificationTemplate, inviteTemplate } from './templates/index.js';

/**
 * Sends an email safely, swallowing errors to prevent domain crashes,
 * while logging them for infrastructure tracking.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 * @returns {Promise<boolean>} - True if sent, false otherwise
 */
const dispatchEmail = async (to, subject, html) => {
  const msg = { from: config.email.from, to, subject, html };
  try {
    await sendMail(msg);
    logger.info({ event: 'system.email.sent', to: to.substring(0, 3) + '***@***.com' }, `Email sent: ${subject}`);
    return true;
  } catch (error) {
    // Sanitize the error log to avoid leaking SMTP passwords in stack traces or raw messages
    const sanitizedErrorMessage = error.message
      ? error.message.replace(config.email.smtp.auth.pass, '***')
      : 'Unknown error';
    logger.error(
      { event: 'system.email.failed', error: sanitizedErrorMessage },
      `Failed to send email to ${to.substring(0, 3) + '***@***.com'}`,
    );
    // Note: We swallow the error here intentionally so that the caller (domain service)
    // doesn't crash the request handler if an email fails.
    return false;
  }
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const sendPasswordResetEmail = async (to, token) => {
  const subject = 'Reset Your Password - Rentru';
  const resetPasswordUrl = `${config.appUrl}/reset-password?token=${token}`;
  const html = resetPasswordTemplate(resetPasswordUrl);
  return dispatchEmail(to, subject, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = 'Verify Your Email - Rentru';
  const verificationEmailUrl = `${config.appUrl}/verify-email?token=${token}`;
  const html = verificationTemplate(verificationEmailUrl);
  return dispatchEmail(to, subject, html);
};

/**
 * Send an invitation email
 * @param {string} to
 * @param {string} inviteToken
 * @param {string} inviterName
 * @returns {Promise<boolean>}
 */
const sendInviteEmail = async (to, inviteToken, inviterName) => {
  const subject = `${inviterName} has invited you to Rentru`;
  const inviteUrl = `${config.appUrl}/accept-invite?token=${inviteToken}`;
  const html = inviteTemplate(inviteUrl, inviterName);
  return dispatchEmail(to, subject, html);
};

export { sendPasswordResetEmail, sendVerificationEmail, sendInviteEmail };
