import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../logger.js';

const transport = nodemailer.createTransport(config.email.smtp);

/**
 * Verify SMTP connection
 * Should be called during application bootstrap
 * @returns {Promise<void>}
 */
const verifySmtpConnection = async () => {
  if (config.env === 'test') {
    return;
  }
  try {
    await transport.verify();
    logger.info({ event: 'system.email.connected' }, 'Connected to email server via SMTP');
  } catch {
    logger.warn(
      { event: 'system.email.connection_failed' },
      'Unable to connect to email server. Make sure you have configured the SMTP options in .env',
    );
  }
};

/**
 * Send an email directly via the transporter
 * @param {Object} msg - The message object for nodemailer
 * @returns {Promise}
 */
const sendMail = async (msg) => {
  return transport.sendMail(msg);
};

export { transport, verifySmtpConnection, sendMail };
