/**
 * sync_guper_cron_actual_25min.js
 *
 * NO borra información.
 * Worker recurrente para el DÍA ACTUAL.
 *
 * Cada 25 minutos consulta TODAS las órdenes del día actual con email,
 * busca en Guper y hace INSERT/UPDATE en dbo.REGISTROS_GUPER.
 *
 * Importante:
 * - Los registros OK también se vuelven a consultar y se actualizan.
 * - not_found/error se reintentan en cada ciclo y también en el cierre de día.
 * - No procesa día anterior, salvo que uses TARGET_DATE manual para pruebas.
 *
 * Uso:
 * node sync_guper_cron_actual_25min.js
 * node sync_guper_cron_actual_25min.js --once
 * node sync_guper_cron_actual_25min.js --once --eod-retry
 *
 * Requiere:
 * npm install mssql dotenv
 *
 * .env:
 * DB_USER=
 * DB_PASSWORD=
 * DB_SERVER=
 * DB_DATABASE=NS_Orders
 * GUPER_TOKEN=
 * GUPER_BASE_URL=https://cloe.myguper.com/api
 * RUN_EVERY_MINUTES=25
 * END_OF_DAY_RETRY_TIME=23:30
 * TIMEZONE=America/Mexico_City
 * RUN_ON_START=true
 *
 * # TARGET_DATE=2026-06-12
 * # opcional solo para pruebas/backfill.
 * # En producción déjalo vacío.
 */

require("dotenv").config();

const sql = require("mssql");
const https = require("https");

const DB_CONFIG = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  requestTimeout: 60000,
  connectionTimeout: 30000,
};

const GUPER_BASE_URL = process.env.GUPER_BASE_URL || "https://cloe.myguper.com/api";
const GUPER_TOKEN = process.env.GUPER_TOKEN;

// Por default siempre procesa el día actual en TIMEZONE.
// TARGET_DATE solo es para pruebas/backfill manual; en producción déjalo vacío.
const TARGET_DATE_OVERRIDE = process.env.TARGET_DATE || null;

// ----------------------------------------------------------------------
// Configuración del worker recurrente
// ----------------------------------------------------------------------
const RUN_EVERY_MINUTES = Number(
  process.env.RUN_EVERY_MINUTES || process.env.SYNC_INTERVAL_MINUTES || 25
);

const END_OF_DAY_RETRY_TIME = process.env.END_OF_DAY_RETRY_TIME || "23:30";
const TIMEZONE = process.env.TIMEZONE || "America/Mexico_City";
const RUN_ON_START = String(process.env.RUN_ON_START ?? "true").toLowerCase() !== "false";

const ONE_SHOT = process.argv.includes("--once");
const ONE_SHOT_MODE = process.argv.includes("--eod-retry") ? "eod_retry" : "normal";

let T0 = Date.now();

function log(level, msg) {
  const elapsed = ((Date.now() - T0) / 1000).toFixed(2);
  const ts = new Date().toISOString();
  const icon = {
    INFO: "✅",
    WARN: "⚠️ ",
    ERROR: "❌",
    DEBUG: "🔍",
  }[level] || "";

  console.log(`[${ts}] [+${elapsed}s] ${icon} ${level.padEnd(5)} | ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eta(done, total, elapsedMs) {
  if (done === 0) return "calculando...";

  const rate = done / (elapsedMs / 1000);
  const remaining = (total - done) / rate;

  return `~${remaining.toFixed(0)}s restantes`;
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: data,
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function guperHeaders() {
  return {
    "x-guper-authorization": `Bearer ${GUPER_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizarClienteDetalle(payload) {
  if (!payload) return null;

  if (payload.id) return payload;
  if (payload.data?.id) return payload.data;
  if (payload.customer?.id) return payload.customer;
  if (payload.person?.id) return payload.person;

  return null;
}

async function guperBuscarPorEmail(email) {
  const emailKey = normalizarEmail(email);
  const url = `${GUPER_BASE_URL}/register/customer?q[email]=${encodeURIComponent(emailKey)}`;

  const { status, body } = await httpGet(url, guperHeaders());

  if (status !== 200) {
    throw new Error(`Guper search HTTP ${status}: ${body.slice(0, 250)}`);
  }

  const data = JSON.parse(body);

  let list = [];

  if (Array.isArray(data?.list)) {
    list = data.list;
  } else if (Array.isArray(data)) {
    list = data;
  }

  return {
    raw: data,
    list,
  };
}

async function guperDetallePorId(personId) {
  const id = String(personId || "").trim();

  if (!id) return null;

  const url = `${GUPER_BASE_URL}/register/customer/${encodeURIComponent(id)}`;

  const { status, body } = await httpGet(url, guperHeaders());

  if (status !== 200) {
    throw new Error(`Guper detail ${id} HTTP ${status}: ${body.slice(0, 250)}`);
  }

  const data = JSON.parse(body);

  return {
    raw: data,
    cliente: normalizarClienteDetalle(data),
  };
}

async function buscarEnGuperNuevo(email) {
  const search = await guperBuscarPorEmail(email);
  const candidatos = search.list || [];

  if (!candidatos.length) {
    return {
      list: [],
      raw: {
        search: search.raw,
        details: [],
      },
      totalCandidatos: 0,
      detallesConsultados: 0,
      erroresDetalle: [],
    };
  }

  const detalles = [];
  const erroresDetalle = [];

  for (const candidato of candidatos) {
    const id = candidato?.id;

    if (!id) continue;

    try {
      const detailResp = await guperDetallePorId(id);

      if (detailResp?.cliente) {
        detalles.push(detailResp.cliente);
      } else {
        detalles.push(candidato);
      }
    } catch (err) {
      erroresDetalle.push(`${id}: ${err.message}`);
      detalles.push(candidato);
    }

    await sleep(100);
  }

  return {
    list: detalles,
    raw: {
      search: search.raw,
      details: detalles,
      detailErrors: erroresDetalle,
    },
    totalCandidatos: candidatos.length,
    detallesConsultados: detalles.length,
    erroresDetalle,
  };
}

async function asegurarTabla(pool) {
  log("INFO", "Validando tabla dbo.REGISTROS_GUPER...");

  await pool.request().query(`
    IF OBJECT_ID('dbo.REGISTROS_GUPER', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.REGISTROS_GUPER (
        sync_id INT IDENTITY(1,1) PRIMARY KEY,
        order_id INT NOT NULL,
        order_folio NVARCHAR(100),
        order_email NVARCHAR(255) NOT NULL,
        order_external_creation_date DATETIME2 NULL,
        sync_date DATETIME2 DEFAULT GETUTCDATE(),
        http_status NVARCHAR(30),
        error_msg NVARCHAR(1000),

        guper_search_total_candidates INT NULL,
        guper_detail_consulted INT NULL,
        guper_detail_errors NVARCHAR(MAX) NULL,

        guper_raw_json NVARCHAR(MAX),

        guper_id INT,
        guper_main_id INT,
        guper_entity_type NVARCHAR(100),
        guper_name NVARCHAR(255),
        guper_email NVARCHAR(255),
        guper_country_calling_code INT,
        guper_cellphone NVARCHAR(50),
        guper_document NVARCHAR(100),
        guper_gender NVARCHAR(20),
        guper_postal_code NVARCHAR(20),
        guper_date_of_birth NVARCHAR(50),
        guper_language NVARCHAR(50),
        guper_is_homologation INT,
        guper_store INT,
        guper_validated_at NVARCHAR(50),
        guper_optin NVARCHAR(50),
        guper_privacy_accepted NVARCHAR(50),
        guper_created_at NVARCHAR(50),
        guper_updated_at NVARCHAR(50),
        guper_first_name NVARCHAR(150),
        guper_last_name NVARCHAR(150),

        rfm_first_purchase_id INT,
        rfm_last_purchase_id INT,
        rfm_first_purchase_date NVARCHAR(50),
        rfm_last_purchase_date NVARCHAR(50),
        rfm_average_purchase_interval FLOAT,
        rfm_total_purchase_value FLOAT,
        rfm_total_purchases INT,
        rfm_days_without_purchase INT,

        attr_first_store INT,
        attr_last_store INT,
        attr_last_salesperson NVARCHAR(100),

        guper_tags_json NVARCHAR(MAX)
      );

      CREATE INDEX IX_REGISTROS_GUPER_ORDER_ID
      ON dbo.REGISTROS_GUPER(order_id);

      CREATE INDEX IX_REGISTROS_GUPER_EMAIL
      ON dbo.REGISTROS_GUPER(order_email);

      CREATE INDEX IX_REGISTROS_GUPER_GUPER_ID
      ON dbo.REGISTROS_GUPER(guper_id);
    END
  `);

  const columnas = [
    ["order_external_creation_date", "DATETIME2 NULL"],
    ["guper_search_total_candidates", "INT NULL"],
    ["guper_detail_consulted", "INT NULL"],
    ["guper_detail_errors", "NVARCHAR(MAX) NULL"],
  ];

  for (const [col, type] of columnas) {
    await pool.request().query(`
      IF COL_LENGTH('dbo.REGISTROS_GUPER', '${col}') IS NULL
      BEGIN
        ALTER TABLE dbo.REGISTROS_GUPER ADD ${col} ${type};
      END
    `);
  }

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_REGISTROS_GUPER_GUPER_ID'
        AND object_id = OBJECT_ID('dbo.REGISTROS_GUPER')
    )
    BEGIN
      CREATE INDEX IX_REGISTROS_GUPER_GUPER_ID
      ON dbo.REGISTROS_GUPER(guper_id);
    END
  `);

  log("INFO", "Tabla lista. No se borró información.");
}

async function upsertCliente(pool, order, cliente, rawJson, httpStatus, errorMsg, meta = {}) {
  const c = cliente ?? {};
  const rfm = c.rfm ?? {};
  const attr = c.attributes ?? {};
  const tags = Array.isArray(c.tags) ? c.tags : [];

  const orderEmail = normalizarEmail(order.email);
  const guperEmail = normalizarEmail(c.email);
  const guperId = c.id ?? null;

  await pool.request()
    .input("order_id", sql.Int, order.id)
    .input("order_folio", sql.NVarChar(100), order.folio ?? "")
    .input("order_email", sql.NVarChar(255), orderEmail)
    .input("order_external_creation_date", sql.DateTime2, order.external_creation_date ?? null)
    .input("http_status", sql.NVarChar(30), httpStatus)
    .input("error_msg", sql.NVarChar(1000), errorMsg ?? "")

    .input("guper_search_total_candidates", sql.Int, meta.totalCandidatos ?? null)
    .input("guper_detail_consulted", sql.Int, meta.detallesConsultados ?? null)
    .input("guper_detail_errors", sql.NVarChar(sql.MAX), JSON.stringify(meta.erroresDetalle ?? []))

    .input("guper_raw_json", sql.NVarChar(sql.MAX), rawJson)

    .input("guper_id", sql.Int, guperId)
    .input("guper_main_id", sql.Int, c.mainId ?? null)
    .input("guper_entity_type", sql.NVarChar(100), c.entityType ?? "")
    .input("guper_name", sql.NVarChar(255), c.name ?? "")
    .input("guper_email", sql.NVarChar(255), guperEmail)
    .input("guper_country_calling_code", sql.Int, c.countryCallingCode ?? null)
    .input("guper_cellphone", sql.NVarChar(50), c.cellphone ?? "")
    .input("guper_document", sql.NVarChar(100), c.document ?? "")
    .input("guper_gender", sql.NVarChar(20), c.gender ?? "")
    .input("guper_postal_code", sql.NVarChar(20), c.postalCode ?? "")
    .input("guper_date_of_birth", sql.NVarChar(50), c.dateOfBirth ?? "")
    .input("guper_language", sql.NVarChar(50), c.language ?? "")
    .input("guper_is_homologation", sql.Int, c.isHomologation ?? null)
    .input("guper_store", sql.Int, c.store ?? null)
    .input("guper_validated_at", sql.NVarChar(50), c.validatedAt ?? "")
    .input("guper_optin", sql.NVarChar(50), String(c.optin ?? ""))
    .input("guper_privacy_accepted", sql.NVarChar(50), String(c.privacyAccepted ?? ""))
    .input("guper_created_at", sql.NVarChar(50), c.createdAt ?? "")
    .input("guper_updated_at", sql.NVarChar(50), c.updatedAt ?? "")
    .input("guper_first_name", sql.NVarChar(150), c.firstName ?? "")
    .input("guper_last_name", sql.NVarChar(150), c.lastName ?? "")

    .input("rfm_first_purchase_id", sql.Int, rfm.firstPurchaseId ?? null)
    .input("rfm_last_purchase_id", sql.Int, rfm.lastPurchaseId ?? null)
    .input("rfm_first_purchase_date", sql.NVarChar(50), rfm.firstPurchaseDate ?? "")
    .input("rfm_last_purchase_date", sql.NVarChar(50), rfm.lastPurchaseDate ?? "")
    .input("rfm_average_purchase_interval", sql.Float, rfm.averagePurchaseInterval ?? null)
    .input("rfm_total_purchase_value", sql.Float, rfm.totalPurchaseValue ?? null)
    .input("rfm_total_purchases", sql.Int, rfm.totalPurchases ?? null)
    .input("rfm_days_without_purchase", sql.Int, rfm.daysWithoutPurchase ?? null)

    .input("attr_first_store", sql.Int, attr.firstStore ?? null)
    .input("attr_last_store", sql.Int, attr.lastStore ?? null)
    .input("attr_last_salesperson", sql.NVarChar(100), String(attr.lastSalesperson ?? ""))

    .input("guper_tags_json", sql.NVarChar(sql.MAX), JSON.stringify(tags))
    .query(`
      DECLARE @existing_sync_id INT;

      /*
        Upsert por orden del día:
        - Si ya existe OK para el mismo order_id + guper_id, se ACTUALIZA.
        - Si antes quedó not_found/error para ese order_id y ahora Guper sí responde,
          se actualiza ese placeholder a OK.
        - Si vuelve a quedar not_found/error, se actualiza el registro de ese status.

        Esto evita duplicar OK en cada ciclo de 25 minutos, pero sí refresca datos.
      */
      SELECT TOP 1 @existing_sync_id = sync_id
      FROM dbo.REGISTROS_GUPER
      WHERE
        (
          @guper_id IS NOT NULL
          AND order_id = @order_id
          AND guper_id = @guper_id
        )
        OR
        (
          @guper_id IS NOT NULL
          AND order_id = @order_id
          AND guper_id IS NULL
          AND http_status IN ('not_found', 'error')
        )
        OR
        (
          @guper_id IS NULL
          AND order_id = @order_id
          AND LOWER(order_email) = LOWER(@order_email)
          AND http_status = @http_status
        )
      ORDER BY
        CASE
          WHEN @guper_id IS NOT NULL AND order_id = @order_id AND guper_id = @guper_id THEN 1
          WHEN @guper_id IS NOT NULL AND order_id = @order_id AND guper_id IS NULL AND http_status IN ('not_found', 'error') THEN 2
          WHEN @guper_id IS NULL AND order_id = @order_id AND LOWER(order_email) = LOWER(@order_email) AND http_status = @http_status THEN 3
          ELSE 9
        END,
        sync_id DESC;

      IF @existing_sync_id IS NULL
      BEGIN
        INSERT INTO dbo.REGISTROS_GUPER (
          order_id,
          order_folio,
          order_email,
          order_external_creation_date,
          http_status,
          error_msg,
          guper_search_total_candidates,
          guper_detail_consulted,
          guper_detail_errors,
          guper_raw_json,
          guper_id,
          guper_main_id,
          guper_entity_type,
          guper_name,
          guper_email,
          guper_country_calling_code,
          guper_cellphone,
          guper_document,
          guper_gender,
          guper_postal_code,
          guper_date_of_birth,
          guper_language,
          guper_is_homologation,
          guper_store,
          guper_validated_at,
          guper_optin,
          guper_privacy_accepted,
          guper_created_at,
          guper_updated_at,
          guper_first_name,
          guper_last_name,
          rfm_first_purchase_id,
          rfm_last_purchase_id,
          rfm_first_purchase_date,
          rfm_last_purchase_date,
          rfm_average_purchase_interval,
          rfm_total_purchase_value,
          rfm_total_purchases,
          rfm_days_without_purchase,
          attr_first_store,
          attr_last_store,
          attr_last_salesperson,
          guper_tags_json
        ) VALUES (
          @order_id,
          @order_folio,
          @order_email,
          @order_external_creation_date,
          @http_status,
          @error_msg,
          @guper_search_total_candidates,
          @guper_detail_consulted,
          @guper_detail_errors,
          @guper_raw_json,
          @guper_id,
          @guper_main_id,
          @guper_entity_type,
          @guper_name,
          @guper_email,
          @guper_country_calling_code,
          @guper_cellphone,
          @guper_document,
          @guper_gender,
          @guper_postal_code,
          @guper_date_of_birth,
          @guper_language,
          @guper_is_homologation,
          @guper_store,
          @guper_validated_at,
          @guper_optin,
          @guper_privacy_accepted,
          @guper_created_at,
          @guper_updated_at,
          @guper_first_name,
          @guper_last_name,
          @rfm_first_purchase_id,
          @rfm_last_purchase_id,
          @rfm_first_purchase_date,
          @rfm_last_purchase_date,
          @rfm_average_purchase_interval,
          @rfm_total_purchase_value,
          @rfm_total_purchases,
          @rfm_days_without_purchase,
          @attr_first_store,
          @attr_last_store,
          @attr_last_salesperson,
          @guper_tags_json
        );
      END
      ELSE
      BEGIN
        UPDATE dbo.REGISTROS_GUPER
        SET
          order_id = @order_id,
          order_folio = @order_folio,
          order_email = @order_email,
          order_external_creation_date = @order_external_creation_date,
          sync_date = GETUTCDATE(),
          http_status = @http_status,
          error_msg = @error_msg,

          guper_search_total_candidates = @guper_search_total_candidates,
          guper_detail_consulted = @guper_detail_consulted,
          guper_detail_errors = @guper_detail_errors,
          guper_raw_json = @guper_raw_json,

          guper_id = @guper_id,
          guper_main_id = @guper_main_id,
          guper_entity_type = @guper_entity_type,
          guper_name = @guper_name,
          guper_email = @guper_email,
          guper_country_calling_code = @guper_country_calling_code,
          guper_cellphone = @guper_cellphone,
          guper_document = @guper_document,
          guper_gender = @guper_gender,
          guper_postal_code = @guper_postal_code,
          guper_date_of_birth = @guper_date_of_birth,
          guper_language = @guper_language,
          guper_is_homologation = @guper_is_homologation,
          guper_store = @guper_store,
          guper_validated_at = @guper_validated_at,
          guper_optin = @guper_optin,
          guper_privacy_accepted = @guper_privacy_accepted,
          guper_created_at = @guper_created_at,
          guper_updated_at = @guper_updated_at,
          guper_first_name = @guper_first_name,
          guper_last_name = @guper_last_name,

          rfm_first_purchase_id = @rfm_first_purchase_id,
          rfm_last_purchase_id = @rfm_last_purchase_id,
          rfm_first_purchase_date = @rfm_first_purchase_date,
          rfm_last_purchase_date = @rfm_last_purchase_date,
          rfm_average_purchase_interval = @rfm_average_purchase_interval,
          rfm_total_purchase_value = @rfm_total_purchase_value,
          rfm_total_purchases = @rfm_total_purchases,
          rfm_days_without_purchase = @rfm_days_without_purchase,

          attr_first_store = @attr_first_store,
          attr_last_store = @attr_last_store,
          attr_last_salesperson = @attr_last_salesperson,
          guper_tags_json = @guper_tags_json
        WHERE sync_id = @existing_sync_id;
      END
    `);
}

// ----------------------------------------------------------------------
// Consultas por modo
// ----------------------------------------------------------------------
function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    date: `${obj.year}-${obj.month}-${obj.day}`,
    hhmm: `${obj.hour}:${obj.minute}`,
  };
}

function isEndOfDayWindow() {
  const { hhmm } = getLocalParts();

  return hhmm >= END_OF_DAY_RETRY_TIME;
}

function priority(mode) {
  return mode === "eod_retry" ? 2 : 1;
}

async function consultarOrdenes(pool, mode, targetDate) {
  const request = pool.request()
    .input("targetDate", sql.Date, targetDate);

  if (mode === "eod_retry") {
    log(
      "INFO",
      `Modo cierre de día: reintentando MASIVAMENTE todas las órdenes del día actual (${targetDate}), incluyendo ok/not_found/error.`
    );
  } else {
    log(
      "INFO",
      `Modo normal: procesando TODAS las órdenes del día actual (${targetDate}), incluyendo OK para UPDATE.`
    );
  }

  const { recordset } = await request.query(`
    SELECT
      o.id,
      o.folio,
      o.email,
      o.external_creation_date
    FROM dbo.orders o
    WHERE o.email IS NOT NULL
      AND LTRIM(RTRIM(o.email)) <> ''
      AND CAST(o.external_creation_date AS DATE) = @targetDate
    ORDER BY o.external_creation_date ASC, o.id ASC;
  `);

  return recordset;
}

async function procesarOrdenes(pool, ordenes, mode) {
  log("INFO", `Órdenes a procesar (${mode}): ${ordenes.length}`);

  if (ordenes.length === 0) {
    log("WARN", "No hay órdenes para este modo.");
    return;
  }

  let ok = 0;
  let notFound = 0;
  let errors = 0;
  let totalRowsAffected = 0;

  const loopStart = Date.now();

  for (let i = 0; i < ordenes.length; i++) {
    const order = {
      ...ordenes[i],
      email: normalizarEmail(ordenes[i].email),
    };

    const elapsedMs = Date.now() - loopStart;
    const etaStr = eta(i, ordenes.length, elapsedMs || 1);

    log(
      "DEBUG",
      `[${i + 1}/${ordenes.length}] id=${order.id} | folio=${order.folio} | ${order.email} | ${etaStr}`
    );

    try {
      const resp = await buscarEnGuperNuevo(order.email);
      const list = resp.list ?? [];
      const raw = JSON.stringify(resp.raw);

      const meta = {
        totalCandidatos: resp.totalCandidatos,
        detallesConsultados: resp.detallesConsultados,
        erroresDetalle: resp.erroresDetalle,
      };

      if (list.length === 0) {
        notFound++;

        log("WARN", "  ↳ No hallado en Guper");

        await upsertCliente(
          pool,
          order,
          null,
          raw,
          "not_found",
          null,
          meta
        );

        totalRowsAffected++;
      } else {
        ok++;

        log("INFO", `  ↳ ${list.length} detalle(s) encontrado(s)`);

        for (const cliente of list) {
          await upsertCliente(
            pool,
            order,
            cliente,
            raw,
            "ok",
            null,
            meta
          );

          totalRowsAffected++;

          log(
            "INFO",
            `     → Guardado/actualizado: ${cliente.name ?? ""} (guper_id=${cliente.id ?? "N/A"})`
          );
        }
      }
    } catch (err) {
      errors++;

      log("ERROR", `  ↳ Error id=${order.id}: ${err.message}`);

      await upsertCliente(
        pool,
        order,
        null,
        null,
        "error",
        err.message.slice(0, 990),
        {
          totalCandidatos: null,
          detallesConsultados: null,
          erroresDetalle: [err.message],
        }
      );

      totalRowsAffected++;
    }

    await sleep(150);
  }

  const totalSeg = ((Date.now() - T0) / 1000).toFixed(1);

  log("INFO", "══════════════════════════════════════════════════");
  log("INFO", `FINALIZADO (${mode}) en ${totalSeg}s`);
  log("INFO", `✅ Emails encontrados       : ${ok}`);
  log("INFO", `⚠️ No hallados              : ${notFound}`);
  log("INFO", `❌ Errores                  : ${errors}`);
  log("INFO", `📦 Órdenes procesadas       : ${ordenes.length}`);
  log("INFO", `💾 Filas insert/update      : ${totalRowsAffected}`);
  log("INFO", "══════════════════════════════════════════════════");
}

// ----------------------------------------------------------------------
// Runner con lock anti-empalme
// ----------------------------------------------------------------------
let running = false;
let queuedMode = null;
let lastEndOfDayRetryDate = null;

async function runCycle(mode = "normal", reason = "manual") {
  if (running) {
    if (!queuedMode || priority(mode) > priority(queuedMode)) {
      queuedMode = mode;
    }

    log(
      "WARN",
      `Ya hay una ejecución corriendo. Se encoló modo=${queuedMode}. Motivo=${reason}`
    );

    return;
  }

  running = true;
  T0 = Date.now();

  let pool;

  try {
    const { date: localDate, hhmm } = getLocalParts();

    log("INFO", "══════════════════════════════════════════════════");
    log("INFO", `INICIO CICLO | modo=${mode} | motivo=${reason}`);
    log("INFO", `Hora local ${TIMEZONE}: ${localDate} ${hhmm}`);
    log("INFO", "NS_Orders → Guper API nueva → REGISTROS_GUPER");
    log("INFO", "══════════════════════════════════════════════════");

    if (!GUPER_TOKEN) {
      throw new Error("Falta GUPER_TOKEN en .env");
    }

    log("INFO", `Conectando a ${DB_CONFIG.server} / ${DB_CONFIG.database}...`);

    pool = await sql.connect(DB_CONFIG);

    log("INFO", "Conexión exitosa.");

    await asegurarTabla(pool);

    const targetDate = TARGET_DATE_OVERRIDE || localDate;
    const ordenes = await consultarOrdenes(pool, mode, targetDate);

    await procesarOrdenes(pool, ordenes, mode);
  } catch (err) {
    log("ERROR", `Error en ciclo ${mode}: ${err.message}`);
  } finally {
    if (pool) {
      try {
        await pool.close();
        log("INFO", "Conexión cerrada.");
      } catch (closeErr) {
        log("ERROR", `Error cerrando conexión: ${closeErr.message}`);
      }
    }

    running = false;

    if (queuedMode) {
      const nextMode = queuedMode;
      queuedMode = null;

      setImmediate(() => {
        runCycle(nextMode, "queued");
      });
    }
  }
}

function checkEndOfDayRetry() {
  const { date, hhmm } = getLocalParts();

  if (!isEndOfDayWindow()) return;
  if (lastEndOfDayRetryDate === date) return;

  lastEndOfDayRetryDate = date;

  runCycle("eod_retry", `cierre de día automático ${date} ${hhmm}`);
}

async function startWorker() {
  log("INFO", `Worker iniciado. Normal cada ${RUN_EVERY_MINUTES} minutos.`);
  log("INFO", `Cada ciclo procesa el día actual (${TIMEZONE}) e incluye OK para UPDATE.`);
  log("INFO", `Retry masivo de cierre de día: ${END_OF_DAY_RETRY_TIME} ${TIMEZONE}.`);

  if (TARGET_DATE_OVERRIDE) {
    log(
      "WARN",
      `TARGET_DATE activo: ${TARGET_DATE_OVERRIDE}. En producción déjalo vacío para usar el día actual.`
    );
  }

  if (RUN_ON_START) {
    runCycle("normal", "arranque del worker");
  }

  setInterval(() => {
    runCycle("normal", `intervalo ${RUN_EVERY_MINUTES} minutos`);
  }, RUN_EVERY_MINUTES * 60 * 1000);

  setInterval(checkEndOfDayRetry, 60 * 1000);

  checkEndOfDayRetry();
}

process.on("SIGINT", () => {
  log("WARN", "SIGINT recibido. Cerrando proceso.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("WARN", "SIGTERM recibido. Cerrando proceso.");
  process.exit(0);
});

if (ONE_SHOT) {
  runCycle(ONE_SHOT_MODE, "one-shot").then(() => {
    process.exit(0);
  });
} else {
  startWorker().catch((err) => {
    log("ERROR", `Error fatal worker: ${err.message}`);
    process.exit(1);
  });
}
