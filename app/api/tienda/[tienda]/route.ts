import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tienda: string }> }
) {
  const { tienda } = await params;
  const { searchParams } = new URL(req.url);
  const inicio = searchParams.get('inicio');
  const fin = searchParams.get('fin');
  const fecha = searchParams.get('fecha');

  if (!inicio && !fin && !fecha) {
    return NextResponse.json({ error: 'Parámetros de fecha requeridos' }, { status: 400 });
  }

  const nombreTienda = decodeURIComponent(tienda);
  const start = inicio || fecha;
  const end = fin || fecha;

  try {
    const [registrados, tickets_validos, recompras, ordenes, resumenRows, trends] = await Promise.all([
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM registrados WHERE tienda = ? AND DATE(fechaBase) BETWEEN ? AND ? ORDER BY id DESC`,
        [nombreTienda, start, end]
      ),
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM tickets_validos WHERE tienda = ? AND DATE(fechaBase) BETWEEN ? AND ? ORDER BY id DESC`,
        [nombreTienda, start, end]
      ),
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM recompras WHERE tienda = ? AND DATE(fechaBase) BETWEEN ? AND ? ORDER BY id DESC`,
        [nombreTienda, start, end]
      ),
      queryMysql(
        `SELECT id, folio, email, tienda, clientenetsuite, created_date
         FROM orders_netsuite WHERE tienda = ? AND DATE(created_date) BETWEEN ? AND ? ORDER BY id DESC LIMIT 500`,
        [nombreTienda, start, end]
      ),
      queryMysql(
        `SELECT 
           SUM(orders) as orders, 
           SUM(registrados) as registrados, 
           SUM(tickets_validos) as tickets_validos, 
           SUM(recompras) as recompras,
           (SUM(registrados) / NULLIF(SUM(tickets_validos), 0)) * 100 as conversion,
           (SUM(recompras) / NULLIF(SUM(registrados), 0)) * 100 as tasa_recompras
         FROM conversion_por_tienda WHERE tienda = ? AND DATE(fechabase) BETWEEN ? AND ?`,
        [nombreTienda, start, end]
      ),
      queryMysql(
        `SELECT 
           DATE_FORMAT(fechabase, '%Y-%m-%d') as dia,
           orders, registrados, conversion,
           DAYNAME(fechabase) as weekday
         FROM conversion_por_tienda 
         WHERE tienda = ? AND DATE(fechabase) BETWEEN ? AND ?
         ORDER BY fechabase ASC`,
        [nombreTienda, start, end]
      )
    ]);

    const resumen = resumenRows[0];
    
    // Day of week analysis
    const byWeekday: Record<string, { sum: number, count: number }> = {};
    (trends as any[]).forEach(t => {
      if (!byWeekday[t.weekday]) byWeekday[t.weekday] = { sum: 0, count: 0 };
      byWeekday[t.weekday].sum += parseFloat(t.conversion);
      byWeekday[t.weekday].count += 1;
    });
    
    const weekdayAnalysis = Object.entries(byWeekday).map(([name, data]) => ({
      name,
      avg: data.sum / data.count
    })).sort((a,b) => b.avg - a.avg);

    return NextResponse.json({
      tienda: nombreTienda,
      inicio: start,
      fin: end,
      resumen,
      trends, // For charts
      insights: {
        weekdayAnalysis,
        bestDay: weekdayAnalysis[0] || null,
        worstDay: weekdayAnalysis[weekdayAnalysis.length - 1] || null,
        lowDays: (trends as any[]).filter(t => parseFloat(t.conversion) < 60),
        incompleteRegistrations: (registrados as any[]).filter(r => !r.email || r.estado.includes('Sin correo')).length
      },
      registrados,
      tickets_validos,
      recompras,
      ordenes,
    });
  } catch (err) {
    console.error('[/api/tienda/[tienda]]', err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}
