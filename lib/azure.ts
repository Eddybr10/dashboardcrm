import sql from 'mssql';

const useProxy = !!process.env.AZURE_SQL_PROXY_HOST;
const server = useProxy ? process.env.AZURE_SQL_PROXY_HOST! : process.env.AZURE_SQL_SERVER!;

const config: sql.config = {
  server,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true,
    // Si usamos proxy, a veces necesitamos confiar en el certificado porque 
    // el nombre del host (proxy) no coincidirá con el del certificado de Azure.
    trustServerCertificate: useProxy, 
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
