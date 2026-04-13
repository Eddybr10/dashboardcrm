import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicio = searchParams.get('inicio');
  const fin = searchParams.get('fin');
  const fecha = searchParams.get('fecha');

  if (!inicio && !fin && !fecha) {
    return NextResponse.json({ error: 'Parámetros de fecha requeridos' }, { status: 400 });
  }

  try {
    let sql = '';
    let params: any[] = [];

    if (inicio && fin) {
      sql = `
        SELECT tienda, 
               SUM(orders) as orders, 
               SUM(registrados) as registrados, 
               SUM(tickets_validos) as tickets_validos, 
               SUM(recompras) as recompras,
               SUM(verificados) as verificados,
               (SUM(registrados) / NULLIF(SUM(orders), 0)) * 100 as conversion,
               (SUM(recompras) / NULLIF(SUM(registrados), 0)) * 100 as tasa_recompras,
               (SUM(verificados) / NULLIF(SUM(registrados), 0)) * 100 as porcentaje_verificados
        FROM conversion_por_tienda
        WHERE DATE(fechabase) BETWEEN ? AND ?
        GROUP BY tienda
        ORDER BY tienda
      `;
      params = [inicio, fin];
    } else {
      sql = `
        SELECT tienda, orders, registrados, tickets_validos, recompras,
               conversion, tasa_recompras, verificados, porcentaje_verificados, fechabase
        FROM conversion_por_tienda
        WHERE DATE(fechabase) = ?
        ORDER BY tienda
      `;
      params = [fecha];
    }

    const rows = await queryMysql(sql, params);

    return NextResponse.json({ data: rows, inicio, fin, fecha });
  } catch (err) {
    console.error('[/api/tienda]', err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}
