import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio');
  const fechaFin = searchParams.get('fin');
  const zona = searchParams.get('zona');
  const tipo = searchParams.get('tipo');

  if (!fechaInicio || !fechaFin) {
    return NextResponse.json({ error: 'inicio y fin requeridos' }, { status: 400 });
  }

  try {
    let whereExtra = '';
    const params: unknown[] = [fechaInicio, fechaFin];
    if (zona) { whereExtra += ' AND zona = ?'; params.push(zona); }
    if (tipo) { whereExtra += ' AND tipo = ?'; params.push(tipo); }

    // Totales por día (para gráfica)
    const porDia = await queryMysql(
      `SELECT DATE(fechabase) as dia,
              SUM(orders) as tickets,
              SUM(registrados) as registrados,
              SUM(tickets_validos) as tickets_validos,
              SUM(recompras) as recompras
       FROM conversion_por_tienda
       WHERE DATE(fechabase) BETWEEN ? AND ?${whereExtra}
       GROUP BY dia ORDER BY dia`,
      params
    );

    // Totales por tienda en el rango
    const porTienda = await queryMysql(
      `SELECT tienda,
              SUM(orders) as tickets,
              SUM(registrados) as registrados,
              SUM(tickets_validos) as tickets_validos,
              SUM(recompras) as recompras,
              AVG(CAST(conversion AS DECIMAL(5,2))) as conversion_avg,
              AVG(CAST(tasa_recompras AS DECIMAL(5,2))) as recompra_avg
       FROM conversion_por_tienda
       WHERE DATE(fechabase) BETWEEN ? AND ?${whereExtra}
       GROUP BY tienda ORDER BY tickets DESC`,
      params
    );

    // Top zonas
    const zonaParamsForReportes: unknown[] = [fechaInicio, fechaFin];
    let whereExtraReportes = '';
    if (tipo) { whereExtraReportes += ' AND tipo = ?'; zonaParamsForReportes.push(tipo); }

    const porZona = await queryMysql(
      `SELECT zona, SUM(registros) as tickets, SUM(registros) as registrados,
              SUM(recompras) as recompras
       FROM reportes_diarios
       WHERE DATE(fecha) BETWEEN ? AND ?${whereExtraReportes}
       GROUP BY zona ORDER BY tickets DESC`,
      zonaParamsForReportes
    );

    return NextResponse.json({ porDia, porTienda, porZona });
  } catch (err) {
    console.error('[/api/admin/dashboard]', err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}
