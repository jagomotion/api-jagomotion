const app = require('./src/server');
const config = require('./src/config');
const wa = require('./src/wa');

app.listen(config.PORT, () => {
  console.log(`[JAGOMOTION] Server aktif pada port: ${config.PORT}`);
  console.log(`[JAGOMOTION] Buka dokumentasi di: http://localhost:${config.PORT}`);
  wa.autoLoadLocalSessions();
});