import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tienda: string }> }
) {
  const { tienda } = await params;
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get('fecha');

  if (!fecha) {
    return NextResponse.json({ error: 'fecha requerida' }, { status: 400 });
  }

  const nombreTienda = decodeURIComponent(tienda);

  try {
    const [registrados, tickets_validos, recompras, ordenes, resumen] = await Promise.all([
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM registrados WHERE tienda = ? AND DATE(fechaBase) = ? ORDER BY id DESC`,
        [nombreTienda, fecha]
      ),
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM tickets_validos WHERE tienda = ? AND DATE(fechaBase) = ? ORDER BY id DESC`,
        [nombreTienda, fecha]
      ),
      queryMysql(
        `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo, verificado
         FROM recompras WHERE tienda = ? AND DATE(fechaBase) = ? ORDER BY id DESC`,
        [nombreTienda, fecha]
      ),
      queryMysql(
        `SELECT id, folio, email, tienda, clientenetsuite, created_date
         FROM orders_netsuite WHERE tienda = ? AND DATE(created_date) = ? ORDER BY id DESC LIMIT 200`,
        [nombreTienda, fecha]
      ),
      queryMysql(
        `SELECT orders, registrados, tickets_validos, recompras, conversion, tasa_recompras, verificados, porcentaje_verificados
         FROM conversion_por_tienda WHERE tienda = ? AND DATE(fechabase) = ? LIMIT 1`,
        [nombreTienda, fecha]
      ),
    ]);

    return NextResponse.json({
      tienda: nombreTienda,
      fecha,
      resumen: resumen[0] || null,
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
