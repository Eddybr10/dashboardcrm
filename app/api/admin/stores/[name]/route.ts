import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = await paramsPromise;
  const storeName = decodeURIComponent(params.name);
  
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2024-01-01';
  const fechaFin = searchParams.get('fin') || '2026-12-31';

  try {
    // 1. Datos Generales de la Tienda (Azure)
    const azureStats = await queryAzure<any>(
      `SELECT 
        COUNT(o.id) as tickets,
        SUM(CAST(o.total AS DECIMAL(18,2))) as venta_total,
        AVG(CAST(o.total AS DECIMAL(18,2))) as ticket_promedio
       FROM dbo.orders o
       JOIN dbo.locations l ON o.location_id = l.id
       WHERE l.name = @tienda
         AND o.external_creation_date BETWEEN @inicio AND @fin`,
      { tienda: storeName, inicio: fechaInicio, fin: fechaFin }
    );

    // 2. Histórico y Conversión (MySQL)
    const mysqlStats = await queryMysql<any>(
      `SELECT 
        SUM(registrados) as registrados,
        SUM(recompras) as recompras,
        AVG(CAST(conversion AS DECIMAL(5,2))) as conversion_avg
       FROM conversion_por_tienda
       WHERE tienda = ? AND fechabase BETWEEN ? AND ?`,
      [storeName, fechaInicio, fechaFin]
    );

    // 3. Vendedores de esta tienda (Azure)
    const sellers = await queryAzure<any>(
      `SELECT 
        s.name as vendedor,
        COUNT(o.id) as tickets,
        SUM(o.total) as venta
       FROM dbo.orders o
       JOIN dbo.sellers s ON o.seller_id = s.id
       JOIN dbo.locations l ON o.location_id = l.id
       WHERE l.name = @tienda AND o.external_creation_date BETWEEN @inicio AND @fin
       GROUP BY s.name ORDER BY venta DESC`,
      { tienda: storeName, inicio: fechaInicio, fin: fechaFin }
    );

    // 4. Indicadores de "Fraude" (Mismo correo múltiples folios en esta tienda)
    const fraud = await queryMysql<any>(
      `SELECT correo, COUNT(*) as qty, GROUP_CONCAT(DISTINCT vendedor) as vendedores
       FROM ordenes_enriquecidas
       WHERE ubicacion = ? AND correo != '' AND fecha_venta BETWEEN ? AND ?
       GROUP BY correo
       HAVING qty > 1
       ORDER BY qty DESC LIMIT 20`,
      [storeName, fechaInicio, fechaFin]
    );

    // 5. Últimos tickets (Azure)
    const recentTickets = await queryAzure<any>(
      `SELECT TOP 20 o.folio, o.external_creation_date as fecha_venta, o.total, s.name as vendedor, o.email
       FROM dbo.orders o
       JOIN dbo.sellers s ON o.seller_id = s.id
       JOIN dbo.locations l ON o.location_id = l.id
       WHERE l.name = @tienda
       ORDER BY o.external_creation_date DESC`,
      { tienda: storeName }
    );

    return NextResponse.json({
      store: {
        name: storeName,
        metrics: {
          tickets: azureStats[0]?.tickets || 0,
          venta_total: azureStats[0]?.venta_total || 0,
          ticket_promedio: azureStats[0]?.ticket_promedio || 0,
          registrados: mysqlStats[0]?.registrados || 0,
          recompras: mysqlStats[0]?.recompras || 0,
          conversion: mysqlStats[0]?.conversion_avg || 0
        }
      },
      sellers,
      fraud,
      recentTickets
    });

  } catch (err: any) {
    console.error('[/api/admin/stores/[name]]', err);
    return NextResponse.json({ error: 'Error del servidor', detail: err.message }, { status: 500 });
  }
}
