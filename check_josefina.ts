import { queryMysql } from './lib/mysql';

async function check() {
  const q = await queryMysql("SELECT vendedor, correo, count(DISTINCT folio) as folios FROM ordenes_enriquecidas WHERE vendedor LIKE '%08570%' AND correo = 'trufu_lucia@hotmail.com' GROUP BY vendedor, correo");
  console.log("MySQL ordenes_enriquecidas:", q);

  const q2 = await queryMysql("SELECT count(*) as total, count(DISTINCT correo) as unicos FROM ordenes_enriquecidas WHERE vendedor LIKE '%08570%' AND correo != ''");
  console.log("Total vs Unique for Josefina in MySQL:", q2);
  process.exit();
}

check();
