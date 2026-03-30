import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    uri: 'mysql://root:rYjT6bUv4bT2i^9@38.188.136.252:3306/cloemedi_formularios'
  });

  const [rows] = await connection.execute(
    `SELECT vendedor, COUNT(*) as cnt FROM ordenes_enriquecidas WHERE vendedor LIKE '%JOSEFINA%' GROUP BY vendedor`
  );
  console.log("Variaciones de Josefina en ordenes_enriquecidas:", rows);

  const [rows2] = await connection.execute(
    `SELECT vendedor, correo, COUNT(*) as cnt FROM ordenes_enriquecidas WHERE vendedor LIKE '%08570%' GROUP BY vendedor, correo ORDER BY cnt DESC LIMIT 10`
  );
  console.log("Correos más usados por Josefina:", rows2);

  process.exit();
}

main().catch(console.error);
