const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendResetCodeEmail(toEmail, code) {
  await transporter.sendMail({
    from: `"PrintGenie" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your PrintGenie password reset code',
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #1E3A8A;">Reset your password</h2>
        <p>Use this code to reset your PrintGenie account password:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0D192A;">${code}</p>
        <p style="color: #94A3B8; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendResetCodeEmail };