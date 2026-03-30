/**
 * Outbound TCP Proxy for Render -> External Systems
 * 
 * Este script se debe desplegar en un VPS con IP FIJA (DigitalOcean, AWS, etc.)
 * Sirve para que Render se conecte a este proxy y el proxy reenvíe el tráfico
 * al destino final (Azure SQL, MySQL, etc.), haciendo que la IP de origen
 * sea siempre la del VPS.
 */

const net = require('net');

// Configuración vía variables de entorno
const LOCAL_PORT = process.env.PROXY_PORT || 1433; // Puerto donde escucha el proxy (ej. 1433 para SQL)
const TARGET_HOST = process.env.TARGET_HOST;       // Host destino (ej. mi-servidor.database.windows.net)
const TARGET_PORT = process.env.TARGET_PORT || 1433; // Puerto destino

if (!TARGET_HOST) {
  console.error("ERROR: Debes definir la variable de entorno TARGET_HOST");
  process.exit(1);
}

const server = net.createServer((clientSocket) => {
  console.log(`[${new Date().toISOString()}] Nueva conexión desde: ${clientSocket.remoteAddress}`);

  const targetSocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[${new Date().toISOString()}] Conectado al destino: ${TARGET_HOST}:${TARGET_PORT}`);
  });

  // Reenviar datos del cliente al destino
  clientSocket.pipe(targetSocket);
  // Reenviar datos del destino al cliente
  targetSocket.pipe(clientSocket);

  // Manejo de errores y cierre
  clientSocket.on('error', (err) => {
    console.error(`Error en socket cliente: ${err.message}`);
    targetSocket.end();
  });

  targetSocket.on('error', (err) => {
    console.error(`Error en socket destino: ${err.message}`);
    clientSocket.end();
  });

  clientSocket.on('close', () => targetSocket.end());
  targetSocket.on('close', () => clientSocket.end());
});

server.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`--- PROXY DE SALIDA INICIADO ---`);
  console.log(`Escuchando en puerto: ${LOCAL_PORT}`);
  console.log(`Redirigiendo a: ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`---------------------------------`);
});
