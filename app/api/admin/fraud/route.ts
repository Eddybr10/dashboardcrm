import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2025-01-01';
  const fechaFin = searchParams.get('fin') || new Date().toISOString().split('T')[0];

  try {
    const disposableDomains = [
      'yopmail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
      'dispostable.com', '10minutemail.com', 'trashmail.com', 'getnada.com'
    ];
    const disposableList = disposableDomains.map(d => `'${d}'`).join(',');

    // 1. Domain Spoofing Inter-Dominios
    const massSpoofingQuery = `
      SELECT TOP 50
        SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1) AS prefijo,
        COUNT(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email))) AS dominios_qty,
        STRING_AGG(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email)), ', ') AS dominios_list,
        COUNT(*) as folios_afectados,
        STRING_AGG(CONCAT(o.folio, ' ($', CAST(o.total AS INT), ')'), ' | ') AS evidence
      FROM dbo.orders o
      WHERE o.email LIKE '%@%' 
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
        AND LEN(SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1)) > 4
      GROUP BY SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1)
      HAVING COUNT(DISTINCT SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email))) > 1
      ORDER BY dominios_qty DESC, folios_afectados DESC
    `;
    const massSpoofing = await queryAzure(massSpoofingQuery, { inicio: fechaInicio, fin: fechaFin });

    // 2. Velocity Weekly (3+ uses in 7 days)
    const velocityWeeklyQuery = `
      SELECT TOP 50
        o.email AS correo,
        COUNT(*) AS total_usos,
        COUNT(DISTINCT s.name) AS vendedores_distintos,
        STRING_AGG(DISTINCT s.name, ', ') AS lista_vendedores,
        STRING_AGG(CONCAT(o.folio, ' (', CAST(o.external_creation_date AS DATE), ')'), ' | ') AS evidence,
        SUM(o.total) as total_venta
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email != '' 
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
      GROUP BY o.email
      HAVING COUNT(*) >= 3
      ORDER BY total_usos DESC
    `;
    const velocityWeekly = await queryAzure(velocityWeeklyQuery, { inicio: fechaInicio, fin: fechaFin });

    // 3. Address/Phone Cross-Reference (Multiple emails for same contact data)
    const contactReuseQuery = `
      SELECT TOP 50
        a.phone,
        COUNT(DISTINCT o.email) AS emails_qty,
        STRING_AGG(DISTINCT o.email, ', ') AS emails_list,
        COUNT(*) as tickets_qty,
        STRING_AGG(o.folio, ' | ') AS folios_list
      FROM dbo.addresses a
      JOIN dbo.orders o ON a.order_id = o.id
      WHERE a.phone != '' AND a.phone IS NOT NULL
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
      GROUP BY a.phone
      HAVING COUNT(DISTINCT o.email) > 1
      ORDER BY emails_qty DESC, tickets_qty DESC
    `;
    const contactReuse = await queryAzure(contactReuseQuery, { inicio: fechaInicio, fin: fechaFin });

    // 4. Ranking de Falsificación (Seller Score)
    const sellerScoresQuery = `
      SELECT TOP 50
        s.name AS vendedor,
        COUNT(*) AS total_registros,
        COUNT(DISTINCT o.email) AS correos_unicos,
        (COUNT(*) - COUNT(DISTINCT o.email)) AS correos_repetidos,
        CAST((CAST((COUNT(*) - COUNT(DISTINCT o.email)) AS FLOAT) / CAST(COUNT(*) AS FLOAT)) * 100 AS DECIMAL(5,2)) AS anomaly_ratio
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email != ''
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
      GROUP BY s.name
      HAVING COUNT(*) >= 5
      ORDER BY anomaly_ratio DESC
    `;
    const sellerScores = await queryAzure(sellerScoresQuery, { inicio: fechaInicio, fin: fechaFin });

    // 5. Disposable Alerts
    const disposableAlertsQuery = `
      SELECT TOP 50
        o.email AS correo,
        s.name AS vendedor,
        o.folio,
        o.total as monto,
        o.external_creation_date as fecha,
        l.name as tienda
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      JOIN dbo.locations l ON o.location_id = l.id
      WHERE o.email != '' 
        AND (
          o.email LIKE '%tempmail%' OR o.email LIKE '%yopmail%' OR 
          o.email LIKE '%guerrillamail%' OR
          SUBSTRING(o.email, CHARINDEX('@', o.email) + 1, LEN(o.email)) IN (${disposableList})
        )
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
      ORDER BY o.external_creation_date DESC
    `;
    const disposableAlerts = await queryAzure(disposableAlertsQuery, { inicio: fechaInicio, fin: fechaFin });

    // 6. Sequential Pattern Detection
    const sequentialQuery = `
      SELECT TOP 50
        SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1) AS prefix,
        COUNT(*) as qty,
        STRING_AGG(DISTINCT o.email, ', ') as email_list,
        STRING_AGG(DISTINCT s.name, ', ') as sellers,
        STRING_AGG(o.folio, ' | ') AS evidence
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email LIKE '%[0-9][0-9]@%'
        AND CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
      GROUP BY SUBSTRING(o.email, 1, CHARINDEX('@', o.email) - 1)
      HAVING COUNT(*) >= 2
      ORDER BY qty DESC
    `;
    const sequentialAlerts = await queryAzure(sequentialQuery, { inicio: fechaInicio, fin: fechaFin });

    return NextResponse.json({ 
      massSpoofing, 
      velocityWeekly, 
      contactReuse,
      sellerScores, 
      disposableAlerts,
      sequentialAlerts
    });

  } catch (err: any) {
    console.error('[/api/admin/fraud]', err);
    return NextResponse.json({ error: 'Error de auditoría', detail: err.message }, { status: 500 });
  }
}


