import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2024-01-01';
  const fechaFin = searchParams.get('fin') || '2026-12-31';

  try {
    // 1. Rendimiento por Staff (Basado en correos_registrosMarzo que tiene 'staff')
    const staffPerformance = await queryMysql<any>(
      `SELECT staff as nombre_staff, COUNT(*) as total_registros, 
              GROUP_CONCAT(DISTINCT ubicacion) as tiendas
       FROM correos_registrosMarzo
       WHERE staff != '' AND fecha BETWEEN ? AND ?
       GROUP BY staff
       ORDER BY total_registros DESC LIMIT 50`,
      [fechaInicio, fechaFin]
    );

    // 2. Verificaciones por Staff (Basado en verificados)
    const verificationPerformance = await queryMysql<any>(
      `SELECT Staff as nombre_staff, COUNT(*) as verificaciones
       FROM verificados
       WHERE Staff != '' AND FechaOrden BETWEEN ? AND ?
       GROUP BY Staff
       ORDER BY verificaciones DESC LIMIT 20`,
      [fechaInicio, fechaFin]
    );

    return NextResponse.json({ staffPerformance, verificationPerformance });

  } catch (err: any) {
    console.error('[/api/admin/staff]', err);
    return NextResponse.json({ error: 'Error del servidor de staff', detail: err.message }, { status: 500 });
  }
}
