// setup-env.js — Genera server/.env la primera vez que se instala en una PC nueva.
// No hace nada si server/.env ya existe (para no pisar una configuración real).
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.log('server/.env ya existe, no se modifica.');
  process.exit(0);
}

// Detecta la IP real de red de esta PC preguntándole al sistema operativo qué
// interfaz usaría para salir a internet (no se envía ningún dato: UDP "connect"
// solo resuelve la ruta). Evita elegir adaptadores virtuales (VPN, VirtualBox,
// Hyper-V, etc.) que os.networkInterfaces() podría listar primero por error.
function detectarIP() {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    socket.once('error', () => { socket.close(); resolve(null); });
    socket.connect(80, '8.8.8.8', () => {
      const { address } = socket.address();
      socket.close();
      resolve(address);
    });
  });
}

const ip = await detectarIP();
const secret = crypto.randomBytes(48).toString('hex');
const puerto = 3000;

const contenido = `# Generado automáticamente por setup-env.js — no subir a control de versiones.

PORT=${puerto}
JWT_SECRET=${secret}
SESSION_MINUTES=60

${ip
  ? `# IP de esta PC en su red local. Los QR usan esta dirección para funcionar\n# en celulares conectados a la misma WiFi. Si el router la reasigna, hay que\n# actualizar esta línea y reiniciar el servidor.\nPUBLIC_URL=http://${ip}:${puerto}`
  : `# No se detectó una IP de red local automáticamente. Ajusta esto a mano:\n# PUBLIC_URL=http://<IP-de-esta-PC-en-la-red>:${puerto}`}

# NODE_ENV=production requiere HTTPS (activa cookies "secure"). Déjalo comentado
# mientras se use HTTP en red local; descoméntalo solo si hay dominio con HTTPS.
# NODE_ENV=production
`;

fs.writeFileSync(envPath, contenido);
console.log(`server/.env creado.${ip ? ` IP detectada: ${ip}` : ' No se detectó IP de red — revisa PUBLIC_URL en server/.env a mano.'}`);
