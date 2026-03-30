const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

// Programar para las 00:40 AM todos los días
// Cron format: minute hour day-of-month month day-of-week
const SCHEDULE = '40 0 * * *'; 

console.log('🚀 Programador de Métricas iniciado.');
console.log(`⏰ Tarea programada: Todos los días a las 00:40 AM`);

cron.schedule(SCHEDULE, () => {
  console.log(`\n[${new Date().toLocaleString()}] 🔄 Iniciando ejecución automática de métricas...`);
  
  const scriptPath = path.join(__dirname, 'metricasDi.js');
  const process = spawn('node', [scriptPath]);

  process.stdout.on('data', (data) => {
    console.log(`[LOG]: ${data.toString().trim()}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`[ERROR]: ${data.toString().trim()}`);
  });

  process.on('close', (code) => {
    console.log(`[${new Date().toLocaleString()}] ✅ Ejecución finalizada con código: ${code}`);
  });
});

// Mantener el proceso vivo
process.stdin.resume();
