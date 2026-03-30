import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get('fecha'); // YYYY-MM-DD

  if (!fecha) {
    return NextResponse.json({ error: 'fecha requerida' }, { status: 400 });
  }

  try {
    const rows = await queryMysql<{
      tienda: string;
      orders: number;
      registrados: number;
      tickets_validos: number;
      recompras: number;
      conversion: string;
      tasa_recompras: string;
      verificados: number;
      porcentaje_verificados: string;
      fechabase: string;
    }>(
      `SELECT tienda, orders, registrados, tickets_validos, recompras,
              conversion, tasa_recompras, verificados, porcentaje_verificados, fechabase
       FROM conversion_por_tienda
       WHERE DATE(fechabase) = ?
       ORDER BY tienda`,
      [fecha]
    );

    return NextResponse.json({ data: rows, fecha });
  } catch (err) {
    console.error('[/api/tienda]', err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}
