const { spawn } = require('child_process');
const path = require('path');

// Rango de fechas a procesar
const START_DATE = '2026-02-01';
const END_DATE = '2026-06-07';

function getDatesRange(startStr, endStr) {
  const dates = [];
  let current = new Date(startStr);
  const end = new Date(endStr);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function runForDate(dateStr) {
  return new Promise((resolve) => {
    console.log(`\n=============================================`);
    console.log(`🚀 INICIANDO PROCESAMIENTO: ${dateStr}`);
    console.log(`=============================================\n`);
    
    // Ejecuta metricasDi.js pasando la fecha como argumento
    const child = spawn('node', [path.join(__dirname, 'metricasDi.js'), dateStr], {
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      console.log(`\n✅ Finalizado ${dateStr} con código: ${code}\n`);
      resolve(code);
    });
  });
}

async function main() {
  const dates = getDatesRange(START_DATE, END_DATE);
  console.log(`📅 Rango detectado: ${START_DATE} al ${END_DATE}`);
  console.log(`📊 Días totales a procesar: ${dates.length}`);
  console.log(`⚠️  Aviso: Este proceso puede tardar alrededor de 40-60 minutos debido a consultas a bases de datos y la API de Guper.`);
  
  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    console.log(`\n[Progreso: ${i + 1}/${dates.length}]`);
    
    const code = await runForDate(dateStr);
    if (code !== 0) {
      console.warn(`⚠️ Error en la fecha ${dateStr} (Código de salida: ${code})`);
    }
    
    // Breve pausa de 1.5 segundos entre días para evitar bloqueos por rate limit en la API de Guper
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log('\n🎉 ¡Procesamiento de todo el rango completado exitosamente!');
}

main().catch(console.error);
