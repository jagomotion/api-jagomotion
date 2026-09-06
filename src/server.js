const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const mailer = require('./mailer');
const wa = require('./wa');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

function apiKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key || key !== config.API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak. Header X-API-KEY tidak disertakan atau salah.'
    });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Layanan JagoMotion API beroperasi normal.',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==================== EMAIL ENDPOINTS ====================

app.post('/api/mail/otp', apiKeyMiddleware, async (req, res) => {
  const { email, otp, purpose } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Field email dan otp wajib disertakan.' });
  }

  try {
    const info = await mailer.sendOtpMail(email, otp, purpose);
    return res.json({ success: true, message: 'OTP berhasil dikirim ke email.', messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/mail/reset-password', apiKeyMiddleware, async (req, res) => {
  const { email, resetUrl } = req.body;
  if (!email || !resetUrl) {
    return res.status(400).json({ success: false, message: 'Field email dan resetUrl wajib disertakan.' });
  }

  try {
    const info = await mailer.sendPasswordResetMail(email, resetUrl);
    return res.json({ success: true, message: 'Email reset password berhasil dikirim.', messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/mail/notify', apiKeyMiddleware, async (req, res) => {
  const { email, title, message } = req.body;
  if (!email || !title || !message) {
    return res.status(400).json({ success: false, message: 'Field email, title, dan message wajib disertakan.' });
  }

  try {
    const info = await mailer.sendNotificationMail(email, title, message);
    return res.json({ success: true, message: 'Email notifikasi berhasil dikirim.', messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// FITUR BARU: Kirim email kustom bebas
app.post('/api/mail/send', apiKeyMiddleware, async (req, res) => {
  const { to, subject, html, text } = req.body;
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ success: false, message: 'Field to, subject, dan html/text wajib disertakan.' });
  }

  try {
    const info = await mailer.sendMail({
      to,
      subject,
      html: html ? mailer.wrapSimpleTemplate(subject, html) : undefined,
      text
    });
    return res.json({ success: true, message: 'Email kustom berhasil dikirim.', messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== WHATSAPP ENDPOINTS ====================

app.post('/api/wa/session', apiKeyMiddleware, async (req, res) => {
  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ success: false, message: 'Field number wajib disertakan.' });
  }

  try {
    const result = await wa.initSession(number);
    return res.json({
      success: true,
      message: 'Permintaan sesi pairing berhasil diproses.',
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/wa/sessions', apiKeyMiddleware, (req, res) => {
  const list = wa.getAllSessions();
  res.json({ success: true, total: list.length, sessions: list });
});

// FITUR BARU: Restart koneksi sesi (jika lag / macet)
app.post('/api/wa/restart/:number', apiKeyMiddleware, async (req, res) => {
  const { number } = req.params;
  try {
    const result = await wa.initSession(number);
    return res.json({ success: true, message: 'Sesi berhasil di-restart.', data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/wa/session/:number', apiKeyMiddleware, async (req, res) => {
  const { number } = req.params;
  const deleted = await wa.removeSession(number);
  if (deleted) {
    return res.json({ success: true, message: `Sesi nomor ${number} berhasil dihapus.` });
  }
  return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
});

app.post('/api/wa/send-otp', apiKeyMiddleware, async (req, res) => {
  const { senderNumber, targetNumber, otp, appName } = req.body;
  if (!senderNumber || !targetNumber || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Field senderNumber, targetNumber, dan otp wajib disertakan.'
    });
  }

  const brand = appName || 'JagoMotion';
  const text = `Halo, berikut adalah kode verifikasi akun ${brand} kamu:\n\n*${otp}*\n\nKode ini berlaku 5 menit. Tolong jangan bagikan kode ini kepada siapa pun.`;

  try {
    await wa.sendWhatsAppText(senderNumber, targetNumber, text);
    return res.json({ success: true, message: 'Pesan OTP WhatsApp berhasil dikirim.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// FITUR BARU: Kirim chat kustom bebas ke nomor WhatsApp
app.post('/api/wa/send-message', apiKeyMiddleware, async (req, res) => {
  const { senderNumber, targetNumber, message } = req.body;
  if (!senderNumber || !targetNumber || !message) {
    return res.status(400).json({
      success: false,
      message: 'Field senderNumber, targetNumber, dan message wajib disertakan.'
    });
  }

  try {
    await wa.sendWhatsAppText(senderNumber, targetNumber, message);
    return res.json({ success: true, message: 'Pesan WhatsApp berhasil dikirim.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = app;