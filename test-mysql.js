import { queryMysql } from './lib/mysql.js';

async function test() {
  try {
    const rows = await queryMysql('SELECT * FROM ordenes_enriquecidas LIMIT 1');
    console.log('Columns in ordenes_enriquecidas:', Object.keys(rows[0] || {}));
  } catch (e) {
    console.error(e);
  }
}
test();
