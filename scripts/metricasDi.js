// === DNS override (DEBE ir al inicio) ===
const dns = require('dns')
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])             // Google + Cloudflare
  if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first') // Node 18+
  console.log('🧭 DNS configurado para este proceso:', dns.getServers())
} catch (e) {
  console.warn('No se pudo fijar DNS en runtime:', e?.message || e)
}

const mssql = require('mssql');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');

// Cargar variables de entorno del archivo .env.local de la raíz
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ----------------------------------------------------------------------
// Configuración de conexión a SQL Server
// ----------------------------------------------------------------------
const dbConfig = {
  user: process.env.AZURE_SQL_USER || process.env.DB_USER,
  password: process.env.AZURE_SQL_PASSWORD || process.env.DB_PASSWORD,
  server: process.env.AZURE_SQL_SERVER || process.env.DB_SERVER,
  port: parseInt(process.env.AZURE_SQL_PORT || process.env.DB_PORT || '1433'),
  database: process.env.AZURE_SQL_DATABASE || process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// ----------------------------------------------------------------------
// Configuración de conexión a MySQL
// ----------------------------------------------------------------------
const mysqlConfig = {
  host: process.env.MYSQL_HOST || "69.6.202.82",
  user: process.env.MYSQL_USER || "cloemedi_user",
  password: process.env.MYSQL_PASSWORD || "UnaPassSegura123!-",
  database: process.env.MYSQL_DATABASE || "cloemedi_formularios"
};

// ----------------------------------------------------------------------
// === Guper API CONFIG ===
const BASE_URL = process.env.GUPER_BASE_URL || "https://cloe.myguper.com/api";
const TOKEN = process.env.GUPER_TOKEN || "3d0131453cee9a7e540dbcd78eb9c8daf31761270b96c3f3d1405a898dda759a";
const HEADERS = {
  "x-guper-authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

// ----------------------------------------------------------------------
// Funciones de clasificación
// ----------------------------------------------------------------------
function categorizarZona(clientenetsuite) {
  const zonas = {
    'CDMX': ['F-2021', 'F-2008', 'B-1010', 'B-1067', 'B-1065', 'B-1052', 'B-1055', 'B-1054', 'B-1064', 'B-1021', 'B-1031'],
    'Centro': ['F-2022', 'F-2016', 'F-2015', 'F-2014', 'F-2012', 'F-2004', 'B-1034', 'B-1048', 'B-1017'],
    'Norte': ['F-2024', 'F-2018', 'B-1003', 'B-1030', 'B-1038', 'B-1058', 'B-1036', 'B-1023', 'B-1002', 'B-1069', 'B-1046'],
    'Occidente': ['F-2050', 'F-2011', 'F-2001', 'B-1015', 'B-1042', 'B-1049', 'B-1041', 'B-1001', 'B-1020', 'B-1047'],
    'Sureste': ['F-2009', 'F-2023', 'B-1004','B-1070', 'B-1039', 'B-1045', 'B-1018', 'B-1066', 'B-1068', 'B-1032', 'B-1026', 'B-1024', 'B-1044', 'B-1025', 'B-1005', 'B-1037', 'B-1053'],
  };
  for (const [zona, tiendas] of Object.entries(zonas)) {
    for (const tienda of tiendas) {
      if (clientenetsuite && clientenetsuite.startsWith(tienda)) {
        return zona;
      }
    }
  }
  return 'FS';
}

function categorizarTipo(clientenetsuite) {
  if (clientenetsuite?.startsWith("B-1") && clientenetsuite !== "B-03952") {
    return "BTQ";
  } else if (clientenetsuite?.startsWith("F-2")) {
    return "FS";
  } else if (["B-03952", "C-03364", "F-4006", "C-04046", "F-03957"].includes(clientenetsuite)) {
    return "otros";
  }
  return "otros";
}

function clientenetsuiteEsValido(clientenetsuite) {
  const todasTiendas = [
    'F-2021', 'F-2008', 'B-1010', 'B-1067', 'B-1065', 'B-1052', 'B-1055', 'B-1054', 'B-1064', 'B-1021', 'B-1031',
    'F-2022', 'F-2016', 'F-2015', 'F-2014', 'F-2012', 'F-2004', 'B-1034', 'B-1048', 'B-1017',
    'F-2024', 'F-2018', 'B-1003', 'B-1030', 'B-1038', 'B-1058', 'B-1036', 'B-1023', 'B-1002', 'B-1069', 'B-1046',
    'F-2050', 'F-2011', 'F-2001', 'B-1015', 'B-1042', 'B-1049', 'B-1041', 'B-1001', 'B-1020', 'B-1047',
    'F-2009', 'F-2023', 'B-1004','B-1070', 'B-1039', 'B-1045', 'B-1018', 'B-1066', 'B-1068', 'B-1032', 'B-1026', 'B-1024', 'B-1044', 'B-1025', 'B-1005', 'B-1037', 'B-1053'
  ];
  return todasTiendas.some(tienda => clientenetsuite?.startsWith(tienda));
}

// ----------------------------------------------------------------------
// Conexión y consulta a SQL Server
// ----------------------------------------------------------------------
async function getConnection() {
  try {
    const pool = await mssql.connect(dbConfig);
    return pool;
  } catch (err) {
    console.error('❌ Error al conectar a SQL Server:', err);
    throw err;
  }
}

async function getOrdersByDate(fecha) {
  const pool = await getConnection();
  const query = `
SELECT 
  o.folio, 
  o.email, 
  o.external_creation_date AS created_date,
  l.name AS tienda, 
  pc.name AS clientenetsuite, 
  s.name AS seller_name
FROM orders o
INNER JOIN locations l ON o.location_id = l.id
INNER JOIN platform_clients pc ON o.platform_client_id = pc.id
INNER JOIN sellers s ON o.seller_id = s.id
WHERE CAST(o.external_creation_date AS DATE) = @fecha
  `;
  const result = await pool.request()
    .input('fecha', mssql.Date, fecha)
    .query(query);
  return result.recordset;
}

// ----------------------------------------------------------------------
// Función para clasificar y consultar la API de Guper para cada orden
// ----------------------------------------------------------------------
async function verificarTagYClasificar(email, folio, fechaEsperada, tienda, clientenetsuite, sellerName) {
  const url = `${BASE_URL}/register/customer?q[email]=${encodeURIComponent(email)}`;
  const zona = categorizarZona(clientenetsuite);
  const tipo = categorizarTipo(clientenetsuite);
  const fechaBase = fechaEsperada;

  try {
    const response = await axios.get(url, { headers: HEADERS });
    const data = response.data;

    // SIN CORREO
    if (!email || email.trim() === "") {
      return {
        categoria: "Ticket Válido",
        folio,
        email: "",
        estado: "🎫 Sin correo (válido por tienda)",
        fecha: "",
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado: false,
        name: "",
        cellphone: ""
      };
    }

    // NO ENCONTRADO
    if (!data || !data.list || data.list.length === 0) {
      return {
        categoria: "Ticket Válido",
        folio,
        email,
        estado: "❌ No encontrado",
        fecha: "",
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado: false,
        name: "",
        cellphone: ""
      };
    }

    const cliente = data.list[0];
    const name = cliente.name || "";
    const cellphone = cliente.cellphone || "";
    const tags = Array.isArray(cliente.tags) ? cliente.tags : [];

    const tag119 = tags.find(t => t.tag === 119);
    const tag207 = tags.find(t => t.tag === 207);

    // EXTRAER FECHAS
    let fechaTag119 = "";
    if (tag119?.createdAt) {
      fechaTag119 = typeof tag119.createdAt === "string"
        ? tag119.createdAt.split("T")[0]
        : tag119.createdAt.date?.split(" ")[0] || "";
    }

    let fechaTag207 = "";
    if (tag207?.createdAt) {
      fechaTag207 = typeof tag207.createdAt === "string"
        ? tag207.createdAt.split("T")[0]
        : tag207.createdAt.date?.split(" ")[0] || "";
    }

    let fechaRegistro = "";
    if (cliente.createdAt) {
      fechaRegistro = typeof cliente.createdAt === "string"
        ? cliente.createdAt.split("T")[0]
        : cliente.createdAt.date?.split(" ")[0] || "";
    }

    const verificado = (fechaTag207 === fechaEsperada); 

    // CLASIFICACIÓN
    if (fechaTag119 === fechaEsperada && fechaRegistro === fechaEsperada) {
      return {
        categoria: "Registrados",
        folio,
        email,
        estado: "✅ Registro Nuevo",
        fecha: fechaTag119,
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado,
        name,
        cellphone,
        staff: sellerName
      };
    } else if (fechaTag119 === fechaEsperada) {
      return {
        categoria: "Registrados",
        folio,
        email,
        estado: "📝 Actualizado",
        fecha: fechaTag119,
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado,
        name,
        cellphone
      };
    } else if (tag119) {
      return {
        categoria: "Recompras",
        folio,
        email,
        estado: "⚠️ Registro Previo",
        fecha: fechaTag119,
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado,
        name,
        cellphone,
        staff: sellerName

      };
    } else {
      return {
        categoria: "Ticket Válido",
        folio,
        email,
        estado: "⛔ Sin Tag 119",
        fecha: "",
        fechaBase,
        tienda,
        clientenetsuite,
        zona,
        tipo,
        verificado,
        name,
        cellphone
      };
    }

  } catch (error) {
    return {
      categoria: "Ticket Válido",
      folio,
      email,
      estado: `⚠️ Error: ${error.message}`,
      fecha: "",
      fechaBase,
      tienda,
      clientenetsuite,
      zona,
      tipo,
      verificado: false,
      name: "",
      cellphone: ""
    };
  }
}

// ----------------------------------------------------------------------
// Función para deduplicar por correo
// ----------------------------------------------------------------------
function deduplicarPorCorreo(array) {
  const deduplicados = {};
  array.forEach(item => {
    if (!item.email || item.email.trim() === "") {
      deduplicados[item.folio] = item;
    } else {
      const key = item.email.toLowerCase();
      if (!deduplicados[key] || item.folio.localeCompare(deduplicados[key].folio) > 0) {
        deduplicados[key] = item;
      }
    }
  });
  return Object.values(deduplicados);
}

// ----------------------------------------------------------------------
// Función para agrupar resultados por tienda y generar el resumen de conversión
// ----------------------------------------------------------------------
function generarResumenPorTienda(resultados, fechaBase) {
  const tiendaSummary = {};
  resultados.forEach(r => {
    if (!clientenetsuiteEsValido(r.clientenetsuite)) return;
    const tienda = r.tienda || 'SIN_TIENDA';

    if (!tiendaSummary[tienda]) {
      tiendaSummary[tienda] = {
        orders: 0,
        registrados: new Set(),
        verificados: new Set(),
        ticketsValidos: new Set(),
        recompras: new Set(),
        ticketsValidosSinEmail: 0
      };
    }

    tiendaSummary[tienda].orders++;

    if (r.categoria === "Registrados") {
      const emailKey = r.email?.toLowerCase();
      if (emailKey) {
        tiendaSummary[tienda].registrados.add(emailKey);
        if (r.verificado) tiendaSummary[tienda].verificados.add(emailKey);
      }
    }

    if (r.categoria === "Recompras" && r.email?.trim()) {
      tiendaSummary[tienda].recompras.add(r.email.toLowerCase());
    }

    if (r.categoria === "Ticket Válido") {
      if (r.email?.trim()) {
        tiendaSummary[tienda].ticketsValidos.add(r.email.toLowerCase());
      } else {
        tiendaSummary[tienda].ticketsValidosSinEmail++;
      }
    }
  });

  const tiendaArray = Object.entries(tiendaSummary).map(([tienda, vals]) => {
    const { orders, registrados, verificados, ticketsValidos, recompras, ticketsValidosSinEmail } = vals;
    const unionValidos = new Set([...registrados, ...ticketsValidos]);
    const totalTicketsValidos = unionValidos.size + ticketsValidosSinEmail;

    const conversion = totalTicketsValidos > 0
      ? ((registrados.size / totalTicketsValidos) * 100).toFixed(2)
      : "0.00";

    const tasaRecompras = (registrados.size + recompras.size) > 0
      ? ((recompras.size / (registrados.size + recompras.size)) * 100).toFixed(2)
      : "0.00";

    const porcentajeVerificados = registrados.size > 0
      ? ((verificados.size / registrados.size) * 100).toFixed(2)
      : "0.00";

    return {
      tienda,
      orders,
      registrados: registrados.size,
      ticketsValidos: totalTicketsValidos,
      recompras: recompras.size,
      conversion,
      tasaRecompras,
      verificados: verificados.size,
      porcentajeVerificados,
      fechabase: fechaBase
    };
  });

  tiendaArray.sort((a, b) => a.tienda.localeCompare(b.tienda));
  return tiendaArray;
}

// ----------------------------------------------------------------------
// Función para crear tablas en MySQL (si no existen)
// ----------------------------------------------------------------------
async function createTablesMySQL(conn) {
  console.log("🛠  Creando tablas si no existen...");
  const createCategorizados = `
    CREATE TABLE IF NOT EXISTS categorizados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(50),
      folio VARCHAR(50) UNIQUE,
      email VARCHAR(255),
      estado VARCHAR(255),
      fecha VARCHAR(20),
      fechaBase VARCHAR(20),
      tienda VARCHAR(255),
      clientenetsuite VARCHAR(255),
      zona VARCHAR(50),
      tipo VARCHAR(50),
      verificado TINYINT(1) DEFAULT 0
    )
  `;
  const createConversion = `
    CREATE TABLE IF NOT EXISTS conversion_por_tienda (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tienda VARCHAR(255),
      orders INT,
      registrados INT,
      tickets_validos INT,
      recompras INT,
      conversion DECIMAL(5,2),
      tasa_recompras DECIMAL(5,2),
      verificados INT,
      porcentaje_verificados DECIMAL(5,2),
      fechabase DATE,
      UNIQUE KEY uk_tienda_fecha (tienda, fechabase)
    )
  `;
  const createOrders = `
    CREATE TABLE IF NOT EXISTS orders_netsuite (
      id INT AUTO_INCREMENT PRIMARY KEY,
      folio VARCHAR(50) UNIQUE,
      email VARCHAR(255),
      created_date DATETIME,
      tienda VARCHAR(255),
      clientenetsuite VARCHAR(255)
    )
  `;
  const createRegistrados = `
    CREATE TABLE IF NOT EXISTS registrados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(50),
      folio VARCHAR(50) UNIQUE,
      email VARCHAR(255),
      estado VARCHAR(255),
      fecha VARCHAR(20),
      fechaBase VARCHAR(20),
      tienda VARCHAR(255),
      clientenetsuite VARCHAR(255),
      zona VARCHAR(50),
      tipo VARCHAR(50),
      verificado TINYINT(1) DEFAULT 0
    )
  `;
  const createRecompras = `
    CREATE TABLE IF NOT EXISTS recompras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(50),
      folio VARCHAR(50) UNIQUE,
      email VARCHAR(255),
      estado VARCHAR(255),
      fecha VARCHAR(20),
      fechaBase VARCHAR(20),
      tienda VARCHAR(255),
      clientenetsuite VARCHAR(255),
      zona VARCHAR(50),
      tipo VARCHAR(50),
      verificado TINYINT(1) DEFAULT 0
    )
  `;
  const createTicketsValidos = `
    CREATE TABLE IF NOT EXISTS tickets_validos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(50),
      folio VARCHAR(50) UNIQUE,
      email VARCHAR(255),
      estado VARCHAR(255),
      fecha VARCHAR(20),
      fechaBase VARCHAR(20),
      tienda VARCHAR(255),
      clientenetsuite VARCHAR(255),
      zona VARCHAR(50),
      tipo VARCHAR(50),
      verificado TINYINT(1) DEFAULT 0
    )
  `;
  const createVerificados = `
    CREATE TABLE IF NOT EXISTS verificados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Nombre VARCHAR(255),
      Folio VARCHAR(50) UNIQUE,
      Telefono VARCHAR(50),
      Email VARCHAR(255),
      FechaOrden DATE,
      Tienda VARCHAR(255),
      Staff VARCHAR(255)
    )
  `;

  await conn.query(createCategorizados);
  await conn.query(createConversion);
  await conn.query(createOrders);
  await conn.query(createRegistrados);
  await conn.query(createRecompras);
  await conn.query(createTicketsValidos);
  await conn.query(createVerificados);
  console.log("✅ Tablas en MySQL creadas (si no existían).");
}

// ----------------------------------------------------------------------
// Helper: ejecutar INSERT en chunks con logs
// ----------------------------------------------------------------------
async function ejecutarInsertEnChunks(conn, query, values, table, chunkSize = 500) {
  console.log(`🧩 Insertando en '${table}' en chunks. Filas totales: ${values.length}, chunkSize: ${chunkSize}`);
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    console.log(`➡️  Chunk ${table} [${i} - ${i + chunk.length - 1}] (${chunk.length} filas)`);
    try {
      await conn.query(query, [chunk]);
    } catch (err) {
      console.error(`❌ Error en chunk de la tabla ${table}:`, {
        message: err.message,
        code: err.code,
        errno: err.errno,
        fatal: err.fatal
      });
      throw err; 
    }
  }
}

// ----------------------------------------------------------------------
// Función para insertar datos en MySQL
// ----------------------------------------------------------------------
async function insertarDatosMySQL(conn, table, dataArray) {
  if (!dataArray.length) {
    console.log(`ℹ️  Tabla ${table}: no hay datos que insertar.`);
    return;
  }
  let query = "";
  let values = [];

  console.log(`📦 Preparando insert en tabla '${table}' con ${dataArray.length} registros...`);

  if (
    table === "categorizados" ||
    table === "registrados" ||
    table === "recompras" ||
    table === "tickets_validos"
  ) {
    query = `INSERT INTO ${table} 
  (categoria, folio, email, estado, fecha, fechaBase, tienda, clientenetsuite, zona, tipo, verificado) 
  VALUES ? 
  ON DUPLICATE KEY UPDATE 
    email = VALUES(email),
    estado = VALUES(estado),
    fecha = VALUES(fecha),
    fechaBase = VALUES(fechaBase),
    tienda = VALUES(tienda),
    clientenetsuite = VALUES(clientenetsuite),
    zona = VALUES(zona),
    tipo = VALUES(tipo),
    verificado = VALUES(verificado)`;

    values = dataArray.map(r => [
      r.categoria,
      r.folio,
      r.email,
      r.estado,
      r.fecha,
      r.fechaBase,
      r.tienda,
      r.clientenetsuite,
      r.zona,
      r.tipo,
      r.verificado ? 1 : 0
    ]);

  } else if (table === "conversion_por_tienda") {
    query = `INSERT INTO conversion_por_tienda 
      (tienda, orders, registrados, tickets_validos, recompras, conversion, tasa_recompras, fechabase, verificados, porcentaje_verificados) 
      VALUES ? 
      ON DUPLICATE KEY UPDATE 
        orders = VALUES(orders), 
        registrados = VALUES(registrados), 
        tickets_validos = VALUES(tickets_validos), 
        recompras = VALUES(recompras), 
        conversion = VALUES(conversion), 
        tasa_recompras = VALUES(tasa_recompras),
        verificados = VALUES(verificados),
        porcentaje_verificados = VALUES(porcentaje_verificados)`;

    values = dataArray.map(obj => [
      obj.tienda,
      obj.orders,
      obj.registrados,
      obj.ticketsValidos,
      obj.recompras,
      obj.conversion,
      obj.tasaRecompras,
      obj.fechabase,
      obj.verificados,
      obj.porcentajeVerificados
    ]);

  } else if (table === "orders_netsuite") {
    query = `INSERT INTO orders_netsuite 
      (folio, email, created_date, tienda, clientenetsuite) 
      VALUES ? 
      ON DUPLICATE KEY UPDATE folio = folio`;

    values = dataArray.map(o => [
      o.folio,
      o.email,
      o.created_date,
      o.tienda,
      o.clientenetsuite
    ]);
  } else {
    console.warn(`⚠️ insertarDatosMySQL llamado con tabla desconocida: ${table}`);
    return;
  }

  console.log(`📝 Ejemplo de fila para '${table}':`, values[0]);

  try {
    await ejecutarInsertEnChunks(conn, query, values, table, 500);
    console.log(`✅ Datos insertados en la tabla ${table}.`);
  } catch (err) {
    console.error(`❌ Error al insertar en la tabla ${table} (final):`, {
      message: err.message,
      code: err.code,
      errno: err.errno,
      fatal: err.fatal
    });
  }
}

// ----------------------------------------------------------------------
// Insert verificados con logs + chunks
// ----------------------------------------------------------------------
async function insertarVerificadosLibro(conn, verificadosArray) {
  if (!verificadosArray.length) {
    console.log("ℹ️  No hay verificados para insertar.");
    return;
  }

  console.log(`📚 Preparando insert en 'verificados' con ${verificadosArray.length} filas...`);

  const query = `
    INSERT INTO verificados (Nombre, Folio, Telefono, Email, FechaOrden, Tienda, Staff)
    VALUES ?
    ON DUPLICATE KEY UPDATE 
      Telefono = VALUES(Telefono),
      FechaOrden = VALUES(FechaOrden),
      Tienda = VALUES(Tienda),
      Staff = VALUES(Staff)
  `;

  const values = verificadosArray.map(f => [
    f.Nombre,
    f.Folio,
    f.Telefono,
    f.Email,
    f.FechaOrden,
    f.Tienda,
    f.Staff
  ]);

  console.log("📝 Ejemplo de fila verificados:", values[0]);

  try {
    await ejecutarInsertEnChunks(conn, query, values, "verificados", 500);
    console.log(`✅ Verificados insertados en tabla 'verificados'.`);
  } catch (err) {
    console.error("❌ Error al insertar en tabla 'verificados' (final):", {
      message: err.message,
      code: err.code,
      errno: err.errno,
      fatal: err.fatal
    });
  }
}

// ----------------------------------------------------------------------
// Función para guardar el resumen por tienda en CSV
// ----------------------------------------------------------------------
function saveResumenCsv(tiendaArray, startDate) {
  const convHeader = "Tienda,Orders,Registrados,Tickets Válidos,Recompras,Conversion (%),Tasa Recompras (%),Verificados,% Verificados,FechaBase";
  const convLines = tiendaArray.map(obj =>
    `${obj.tienda},${obj.orders},${obj.registrados},${obj.ticketsValidos},${obj.recompras},${obj.conversion},${obj.tasaRecompras},${obj.verificados},${obj.porcentajeVerificados},${obj.fechabase}`
  );
  const convPath = path.join(__dirname, `../metrica/conversion_por_tienda_${startDate}.csv`);
  fs.writeFileSync(convPath, [convHeader, ...convLines].join("\n"), "utf-8");
  console.log(`\n📊 CSV de conversión por tienda generado: ${convPath}`);
}

// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------
async function main() {
  let inputDate = process.argv[2];
  if (!inputDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    inputDate = yesterday.toISOString().split('T')[0];
    console.log(`📅 No se proporcionó fecha. Usando fecha de ayer: ${inputDate}`);
  }

  const startDate = inputDate;
  console.log(`🔍 Obteniendo órdenes del ${startDate}...\n`);

  let mysqlConn;
  try {
    mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log("✅ Conectado a MySQL (fase ORDERS). threadId:", mysqlConn.threadId);
    await createTablesMySQL(mysqlConn);

    const orders = await getOrdersByDate(startDate);
    console.log(`📦 Órdenes obtenidas de SQL Server: ${orders.length}`);
    if (!orders.length) {
      console.log("⚠️ No se encontraron órdenes en esa fecha.");
      return;
    }

    console.log("➡️ Insertando orders_netsuite en MySQL...");
    await insertarDatosMySQL(mysqlConn, "orders_netsuite", orders);

    const ordersHeader = "Folio,Email,Created_Date,Tienda,clientenetsuite";
    const ordersLines = orders.map(o => `${o.folio},${o.email},${o.created_date},${o.tienda},${o.clientenetsuite}`);
    const metricaDir = path.join(__dirname, '../metrica');
    if (!fs.existsSync(metricaDir)) fs.mkdirSync(metricaDir, { recursive: true });
    
    const ordersCsvPath = path.join(metricaDir, `orders_${startDate}.csv`);
    fs.writeFileSync(ordersCsvPath, [ordersHeader, ...ordersLines].join("\n"), "utf-8");
    console.log(`\n📄 CSV de órdenes generado: ${ordersCsvPath}`);

    await mysqlConn.end();
    console.log("🔒 Conexión a MySQL cerrada tras orders_netsuite.");
    mysqlConn = null;

    const resultados = [];
    console.log("🔎 Clasificando órdenes y consultando Guper...");
    for (const order of orders) {
      const result = await verificarTagYClasificar(
        order.email,
        order.folio,
        startDate,
        order.tienda,
        order.clientenetsuite,
        order.seller_name
      );
      resultados.push(result);
    }
    console.log(`✅ Clasificación inicial completa. Registros: ${resultados.length}`);

    const resultadosDeduplicados = deduplicarPorCorreo(resultados);
    console.log(`✅ Deduplicados por correo. Registros: ${resultadosDeduplicados.length}`);

    const verificados = resultadosDeduplicados.filter(r => r.verificado);
    console.log(`✅ Verificados (tag 207 fecha == ${startDate}): ${verificados.length}`);

    const filasLibro = verificados.map(r => ({
      Nombre: r.name,
      Folio: r.folio,
      Telefono: r.cellphone,
      Email: r.email,
      FechaOrden: r.fechaBase,
      Tienda: r.tienda,
      Staff: r.staff || r.clientenetsuite
    }));
    const header = ["Nombre","Folio","Telefono","Email","FechaOrden","Tienda","Staff"].join(",");

    const lineas = filasLibro.map(f =>
      [f.Nombre, f.Folio, f.Telefono, f.Email, f.FechaOrden, f.Tienda, f.Staff].join(",")
    );
    
    const verificadosCsvPath = path.join(metricaDir, `verificados_${startDate}.csv`);
    fs.writeFileSync(verificadosCsvPath, [header, ...lineas].join("\n"), "utf-8");
    console.log(`✅ CSV de verificados generado: ${verificadosCsvPath}`);

    let registrados = resultadosDeduplicados.filter(r => r.categoria === "Registrados" && clientenetsuiteEsValido(r.clientenetsuite));
    let recompras = resultadosDeduplicados.filter(r => r.categoria === "Recompras" && clientenetsuiteEsValido(r.clientenetsuite));
    let ticketsValidos = resultadosDeduplicados.filter(r => r.categoria === "Ticket Válido" && clientenetsuiteEsValido(r.clientenetsuite));
    const unionTicketsValidos = deduplicarPorCorreo([...ticketsValidos, ...registrados]);

    console.log("\n✅ Clasificación completada:");
    console.log(`📥 Orders: ${orders.length}`);
    console.log(`📥 Registrados (deduplicados): ${registrados.length}`);
    console.log(`🔁 Recompras (deduplicadas): ${recompras.length}`);
    console.log(`🎫 Tickets Válidos (deduplicados): ${ticketsValidos.length}`);

    mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log("🔁 Conectado a MySQL (fase MÉTRICAS). threadId:", mysqlConn.threadId);

    console.log("➡️ Insertando verificados en MySQL...");
    await insertarVerificadosLibro(mysqlConn, filasLibro);

    console.log("➡️ Insertando categorizados / registrados / recompras / tickets_validos...");
    await insertarDatosMySQL(mysqlConn, "categorizados", resultadosDeduplicados);
    await insertarDatosMySQL(mysqlConn, "registrados", registrados);
    await insertarDatosMySQL(mysqlConn, "recompras", recompras);
    await insertarDatosMySQL(mysqlConn, "tickets_validos", unionTicketsValidos);

    console.log("➡️ Generando resumen por tienda...");
    const tiendaArray = generarResumenPorTienda(resultadosDeduplicados, startDate);
    console.log(`✅ Resumen por tienda generado. Tiendas: ${tiendaArray.length}`);

    console.log("➡️ Insertando conversion_por_tienda...");
    await insertarDatosMySQL(mysqlConn, "conversion_por_tienda", tiendaArray);
    saveResumenCsv(tiendaArray, startDate);

    const headerRegistrados = "Categoria,Folio,Email,Estado,Fecha,FechaBase,Tienda,clientenetsuite,zona,tipo,Verificado";
    const ordenar = arr => arr.sort((a, b) => a.tienda.localeCompare(b.tienda) || a.folio.localeCompare(b.folio));

    const saveCsv = (arr, nombre, header) => {
      const sorted = ordenar(arr);
      const lines = [header].concat(sorted.map(r => {
        let base = [
          r.categoria, r.folio, r.email, r.estado, r.fecha, r.fechaBase,
          r.tienda, r.clientenetsuite, r.zona, r.tipo, r.verificado ? "Sí" : "No"
        ];
        return base.join(",");
      }));
      const outPath = path.join(metricaDir, `${nombre}_${startDate}.csv`);
      fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
      console.log(`📤 CSV ${nombre} generado: ${outPath}`);
    };

    saveCsv(registrados, "registrados", headerRegistrados);
    saveCsv(recompras, "recompras", headerRegistrados);
    saveCsv(unionTicketsValidos, "tickets_validos", headerRegistrados);
    saveCsv(resultadosDeduplicados, "categorizados", headerRegistrados);

    const workbook = new ExcelJS.Workbook();
    const sheetConv = workbook.addWorksheet('Conversion_Tienda');
    const convHeader = "Tienda,Orders,Registrados,Tickets Válidos,Recompras,Conversion (%),Tasa Recompras (%),Verificados,% Verificados,FechaBase";
    sheetConv.addRow(convHeader.split(","));
    tiendaArray.forEach(obj => {
      sheetConv.addRow([
        obj.tienda, obj.orders, obj.registrados, obj.ticketsValidos, obj.recompras,
        obj.conversion, obj.tasaRecompras, obj.verificados, obj.porcentajeVerificados, obj.fechabase
      ]);
    });

    const excelPath = path.join(metricaDir, `reporte_metricas_${startDate}.xlsx`);
    await workbook.xlsx.writeFile(excelPath);
    console.log(`\n📄 Archivo Excel consolidado generado: ${excelPath}`);

  } catch (err) {
    console.error('❌ Error al ejecutar MAIN:', err);
  } finally {
    if (mysqlConn) {
      await mysqlConn.end();
      console.log("🔒 Conexión a MySQL cerrada (finally).");
    }
  }
}

main();
