import { queryAzure } from '../lib/azure';

async function run() {
  const massSpoofingQuery = `
      SELECT TOP 5
        SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1) AS prefijo,
        COUNT(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email))) AS dominios_qty,
        STRING_AGG(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email)), ', ') AS dominios_list,
        COUNT(*) as folios_afectados
      FROM dbo.orders o
      WHERE o.email LIKE '%@%' 
        AND o.email NOT LIKE '%@oemoda.com%'
        AND LEN(SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1)) > 4
      GROUP BY SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1)
      HAVING COUNT(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email))) > 1
      ORDER BY dominios_qty DESC
    `;
    const massSpoofing = await queryAzure(massSpoofingQuery);
    console.log('Mass Spoofing:', massSpoofing);

    const velocityAlertsQuery = `
      SELECT TOP 5
        s.name AS vendedor,
        o.email AS correo,
        CAST(o.external_creation_date AS DATE) AS fecha_uso,
        COUNT(*) AS qty
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email != '' 
        AND o.email NOT LIKE '%@oemoda.com%'
      GROUP BY s.name, o.email, CAST(o.external_creation_date AS DATE)
      HAVING COUNT(*) >= 2
      ORDER BY qty DESC
    `;
    const velocityAlerts = await queryAzure(velocityAlertsQuery);
    console.log('Velocity:', velocityAlerts);

    const sellerScoresQuery = `
      SELECT TOP 5
        s.name AS vendedor,
        COUNT(*) AS total_registros,
        COUNT(DISTINCT o.email) AS correos_unicos,
        (COUNT(*) - COUNT(DISTINCT o.email)) AS correos_repetidos,
        CAST((CAST((COUNT(*) - COUNT(DISTINCT o.email)) AS FLOAT) / CAST(COUNT(*) AS FLOAT)) * 100 AS DECIMAL(5,2)) AS anomaly_ratio
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email != ''
      GROUP BY s.name
      ORDER BY anomaly_ratio DESC
    `;
    const sellerScores = await queryAzure(sellerScoresQuery);
    console.log('Seller Scores:', sellerScores);

    const globalClustersQuery = `
      SELECT TOP 5
        o.email AS correo,
        COUNT(DISTINCT s.name) AS sellers_count,
        COUNT(DISTINCT l.name) AS tiendas_count,
        COUNT(*) AS folios_totales,
        STRING_AGG(DISTINCT s.name, ', ') AS sellers_list
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      LEFT JOIN dbo.locations l ON o.location_id = l.id
      WHERE o.email != '' 
        AND o.email NOT LIKE '%@oemoda.com%' 
        AND o.email NOT LIKE '%cloe%'
        AND o.email NOT LIKE '%.com.mx%'
      GROUP BY o.email
      HAVING COUNT(DISTINCT s.name) > 1
      ORDER BY sellers_count DESC
    `;
    const globalClusters = await queryAzure(globalClustersQuery);
    console.log('Global Clusters:', globalClusters);
    
    process.exit(0);
}

run().catch(console.error);
