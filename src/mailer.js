const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
  service: config.SMTP.SERVICE,
  auth: {
    user: config.SMTP.USER,
    pass: config.SMTP.PASS
  }
});

function wrapSimpleTemplate(title, bodyContent) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 24px;
        background-color: #f7f9fa;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1a1a1a;
      }
      .card {
        max-width: 480px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        padding: 32px 24px;
      }
      .brand {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #0969da;
        text-transform: uppercase;
        margin-bottom: 20px;
      }
      .content {
        font-size: 14px;
        line-height: 1.6;
        color: #24292f;
      }
      .code-box {
        font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace;
        font-size: 26px;
        font-weight: bold;
        letter-spacing: 6px;
        color: #0969da;
        background: #f6f8fa;
        border: 1px solid #d0d7de;
        padding: 12px;
        text-align: center;
        border-radius: 6px;
        margin: 20px 0;
      }
      .action-btn {
        display: inline-block;
        padding: 10px 20px;
        background-color: #0969da;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 5px;
        font-weight: 600;
        font-size: 13px;
        margin: 16px 0;
      }
      .footer {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid #eaeef2;
        font-size: 12px;
        color: #6e7781;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">JagoMotion</div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        Pesan otomatis dari sistem JagoMotion. Jangan membalas email ini.
      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({
    from: `"${config.SMTP.FROM_NAME}" <${config.SMTP.USER}>`,
    to,
    subject,
    text,
    html
  });
}

async function sendOtpMail(targetEmail, otpCode, purpose = 'Verifikasi Akun') {
  const content = `
    <p>Halo,</p>
    <p>Berikut adalah kode verifikasi kamu untuk <strong>${purpose}</strong>:</p>
    <div class="code-box">${otpCode}</div>
    <p>Kode ini hanya berlaku selama 5 menit. Jangan berikan kode ini kepada pihak mana pun.</p>
  `;
  return sendMail({
    to: targetEmail,
    subject: `Kode Verifikasi: ${otpCode}`,
    html: wrapSimpleTemplate('Verifikasi OTP', content),
    text: `Kode verifikasi ${purpose} kamu adalah: ${otpCode}. Berlaku 5 menit.`
  });
}

async function sendPasswordResetMail(targetEmail, resetUrl) {
  const content = `
    <p>Halo,</p>
    <p>Kamu menerima email ini karena ada permintaan setel ulang kata sandi pada akun JagoMotion kamu.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="action-btn">Atur Ulang Kata Sandi</a>
    </p>
    <p>Atau klik tautan ini: <br><a href="${resetUrl}" style="color: #0969da; word-break: break-all;">${resetUrl}</a></p>
    <p>Jika kamu tidak merasa melakukan permintaan ini, silakan abaikan pesan ini.</p>
  `;
  return sendMail({
    to: targetEmail,
    subject: 'Setel Ulang Kata Sandi Akun',
    html: wrapSimpleTemplate('Reset Kata Sandi', content),
    text: `Buka tautan ini untuk reset kata sandi: ${resetUrl}`
  });
}

async function sendNotificationMail(targetEmail, title, messageText) {
  const content = `
    <p>Halo,</p>
    <p><strong>${title}</strong></p>
    <p>${messageText}</p>
  `;
  return sendMail({
    to: targetEmail,
    subject: `Notifikasi: ${title}`,
    html: wrapSimpleTemplate('Notifikasi', content),
    text: `${title}\n\n${messageText}`
  });
}

module.exports = {
  sendMail,
  sendOtpMail,
  sendPasswordResetMail,
  sendNotificationMail,
  wrapSimpleTemplate
};