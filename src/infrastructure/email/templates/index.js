/**
 * Generate a reset password email template
 * @param {string} url - The password reset URL
 * @returns {string} - HTML content
 */
const resetPasswordTemplate = (url) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #4A90E2;">Reset Your Password</h2>
      <p>Dear user,</p>
      <p>We received a request to reset your password. Click the link below to securely change it:</p>
      <p>
        <a href="${url}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #4A90E2; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </p>
      <p>If you cannot click the button, copy and paste this link into your browser:</p>
      <p><a href="${url}">${url}</a></p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <br>
      <p>Thanks,</p>
      <p>The Rentru Team</p>
    </div>
  `;
};

/**
 * Generate an email verification template
 * @param {string} url - The verification URL
 * @returns {string} - HTML content
 */
const verificationTemplate = (url) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #4A90E2;">Verify Your Email Address</h2>
      <p>Welcome to Rentru!</p>
      <p>Please click the link below to verify your email address and activate your account:</p>
      <p>
        <a href="${url}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #4A90E2; text-decoration: none; border-radius: 5px;">Verify Email</a>
      </p>
      <p>If you cannot click the button, copy and paste this link into your browser:</p>
      <p><a href="${url}">${url}</a></p>
      <p>If you did not create an account, please safely ignore this email.</p>
      <br>
      <p>Thanks,</p>
      <p>The Rentru Team</p>
    </div>
  `;
};

/**
 * Generate an invite template
 * @param {string} inviteUrl - The invitation URL
 * @param {string} inviterName - Name of the person who invited
 * @returns {string} - HTML content
 */
const inviteTemplate = (inviteUrl, inviterName) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #4A90E2;">You've been invited!</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join them on Rentru.</p>
      <p>Click the link below to accept the invitation and set up your account:</p>
      <p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #4A90E2; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
      </p>
      <p>If you cannot click the button, copy and paste this link into your browser:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <br>
      <p>Thanks,</p>
      <p>The Rentru Team</p>
    </div>
  `;
};

export { resetPasswordTemplate, verificationTemplate, inviteTemplate };
