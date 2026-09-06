const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const config = require('./config');

const sessions = new Map();
const msgRetryCounterCache = new Map();

if (!fs.existsSync(config.PATHS.SESSIONS)) {
  fs.mkdirSync(config.PATHS.SESSIONS, { recursive: true });
}

function cleanNumber(number) {
  if (!number) return '';
  return String(number).replace(/[^0-9]/g, '');
}

// Loader dinamis untuk memuat Baileys (ESM) di dalam CommonJS
let baileysModule = null;
async function getBaileys() {
  if (!baileysModule) {
    baileysModule = await import('baileys');
  }
  return baileysModule;
}

async function initSession(number) {
  const clean = cleanNumber(number);
  const sessionPath = path.join(config.PATHS.SESSIONS, clean);

  // Muat Baileys secara dinamis
  const baileys = await getBaileys();
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    DisconnectReason,
    fetchLatestWaWebVersion,
    makeCacheableSignalKeyStore
  } = baileys;

  // Jika sesi sudah ada dan sedang aktif
  if (sessions.has(clean)) {
    const existing = sessions.get(clean);
    if (existing.status === 'connected') {
      return { status: 'already_connected', message: 'Sesi sudah terhubung.' };
    }
    try { existing.sock?.ws?.close(); } catch (e) {}
    sessions.delete(clean);
  }

  const logger = pino({ level: 'silent' });
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  let waVersion;
  try {
    const v = await fetchLatestWaWebVersion();
    waVersion = v.version;
  } catch (e) {
    waVersion = [2, 3000, 1015901307];
  }

  const sock = makeWASocket({
    version: waVersion,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    maxMsgRetryCount: 5,
    msgRetryCounterCache,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    browser: Browsers.ubuntu('Chrome'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    }
  });

  const sessionObj = {
    number: clean,
    sock,
    status: 'connecting',
    pairingCode: null,
    createdAt: new Date()
  };

  sessions.set(clean, sessionObj);
  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    let handled = false;

    const timer = setTimeout(() => {
      if (!handled && !sock.authState.creds.registered) {
        handled = true;
        resolve({
          status: 'timeout',
          message: 'Koneksi ke WhatsApp lambat. Coba ulangi permintaan beberapa saat lagi.'
        });
      }
    }, 45000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if ((connection === 'connecting' || !!qr) && !sock.authState.creds.registered && !handled) {
        handled = true;
        clearTimeout(timer);
        
        setTimeout(async () => {
          try {
            let code = await sock.requestPairingCode(clean);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            sessionObj.pairingCode = code;
            resolve({ status: 'code_generated', code });
          } catch (err) {
            sessionObj.status = 'error';
            reject(new Error('Gagal meminta kode pairing: ' + err.message));
          }
        }, 3000);
      }

      if (connection === 'open') {
        clearTimeout(timer);
        sessionObj.status = 'connected';
        sessionObj.pairingCode = null;
        console.log(`[WA] Sesi ${clean} terhubung.`);
        if (!handled) {
          handled = true;
          resolve({ status: 'connected', message: 'Sesi berhasil terhubung.' });
        }
      }

      if (connection === 'close') {
        clearTimeout(timer);
        sessionObj.status = 'disconnected';
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession;

        if (isLoggedOut) {
          sessions.delete(clean);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
        } else {
          if (sock.authState.creds.registered) {
            setTimeout(() => initSession(clean), 5000);
          }
        }
      }
    });
  });
}

function getSession(number) {
  return sessions.get(cleanNumber(number));
}

function getAllSessions() {
  const result = [];
  for (const [number, data] of sessions.entries()) {
    result.push({
      number,
      status: data.status,
      createdAt: data.createdAt
    });
  }
  return result;
}

async function removeSession(number) {
  const clean = cleanNumber(number);
  const session = sessions.get(clean);
  if (session?.sock?.ws) {
    try { session.sock.ws.close(); } catch (e) {}
  }
  sessions.delete(clean);

  const sessionPath = path.join(config.PATHS.SESSIONS, clean);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

async function sendWhatsAppText(sessionNumber, targetNumber, text) {
  const cleanSender = cleanNumber(sessionNumber);
  const cleanTarget = cleanNumber(targetNumber);
  const session = sessions.get(cleanSender);

  if (!session || session.status !== 'connected') {
    throw new Error(`Sesi bot ${cleanSender} tidak aktif atau belum tersambung.`);
  }

  const jid = `${cleanTarget}@s.whatsapp.net`;
  return session.sock.sendMessage(jid, { text });
}

function autoLoadLocalSessions() {
  if (!fs.existsSync(config.PATHS.SESSIONS)) return;
  const folders = fs.readdirSync(config.PATHS.SESSIONS);
  for (const folder of folders) {
    const credsPath = path.join(config.PATHS.SESSIONS, folder, 'creds.json');
    if (fs.existsSync(credsPath)) {
      initSession(folder).catch(() => {});
    }
  }
}

module.exports = {
  cleanNumber,
  initSession,
  getSession,
  getAllSessions,
  removeSession,
  sendWhatsAppText,
  autoLoadLocalSessions
};