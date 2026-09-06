const path = require('path');
const os = require('os');

const isServerless = Boolean(process.env.VERCEL);
const basePath = isServerless ? path.join(os.tmpdir(), 'jagomotion') : process.cwd();

module.exports = {
  PORT: process.env.PORT || 3000,
  API_KEY: process.env.API_KEY || 'JAGOMOTION_SECRET_KEY_2026',
  
  SMTP: {
    SERVICE: 'gmail',
    USER: 'e.jagomotion@gmail.com',
    PASS: 'pocw xumx jkgu azev',
    FROM_NAME: 'JagoMotion',
    ADMIN_EMAIL: 'halozacxstore@gmail.com'
  },

  PATHS: {
    BASE: basePath,
    SESSIONS: path.join(basePath, 'sessions')
  }
};