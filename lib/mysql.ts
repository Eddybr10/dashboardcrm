import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const host = process.env.MYSQL_PROXY_HOST || process.env.MYSQL_HOST;

export function getMysqlPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host,
      port: Number(process.env.MYSQL_PORT) || 3306,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function queryMysql<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const pool = getMysqlPool();
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}
