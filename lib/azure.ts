import sql from 'mssql';

const server = process.env.AZURE_SQL_SERVER!;
const port = parseInt(process.env.AZURE_SQL_PORT || process.env.DB_PORT || '1433');

const config: sql.config = {
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  database: process.env.AZURE_SQL_DATABASE!,
  server,
  port,
  options: {
    encrypt: true,
    // Trust the server certificate because we are connecting through a proxy IP
    trustServerCertificate: true, 
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getAzurePool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

export async function queryAzure<T = unknown>(query: string, inputs?: Record<string, unknown>): Promise<T[]> {
  const pool = await getAzurePool();
  const request = pool.request();
  if (inputs) {
    Object.entries(inputs).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  const result = await request.query(query);
  return result.recordset as T[];
}
