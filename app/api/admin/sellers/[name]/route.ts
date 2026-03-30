import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ name: string }> }) {
  // Next.js 15: Await params
  const params = await paramsPromise;
  const sellerName = decodeURIComponent(params.name);
  
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2024-01-01';
  const fechaFin = searchParams.get('fin') || '2026-12-31';

  try {
    // 1. Obtener órdenes de Azure SQL
    const orders = await queryAzure<any>(
      `SELECT 
        o.id as order_id,
        o.folio,
        o.external_creation_date as fecha_venta,
        CAST(o.total AS DECIMAL(18,2)) as venta_importe,
        o.email,
        l.name as tienda,
        rg.sync_id as azure_reg
       FROM dbo.orders o
       JOIN dbo.sellers s ON o.seller_id = s.id
       JOIN dbo.locations l ON o.location_id = l.id
       LEFT JOIN dbo.REGISTROS_GUPER rg ON o.id = rg.order_id
       WHERE s.name = @vendedor
         AND o.external_creation_date BETWEEN @inicio AND @fin
       ORDER BY o.external_creation_date DESC`,
      { vendedor: sellerName, inicio: fechaInicio, fin: fechaFin }
    );

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No se encontraron datos' }, { status: 404 });
    }

    // 2. Triple Check Registration
    const folios = orders.map(o => o.folio);
    const emails = orders.map(o => o.email?.toLowerCase().trim()).filter(e => e && e.length > 3);

    const registeredFolios = new Set<string>();
    const registeredEmails = new Set<string>();

    if (folios.length > 0) {
        const mysqlFolios: any[] = await queryMysql(`SELECT folio FROM registrados WHERE folio IN (${folios.map(() => '?').join(',')})`, folios);
        mysqlFolios.forEach(r => registeredFolios.add(r.folio));
    }

    if (emails.length > 0) {
        const uniqueEmails = Array.from(new Set(emails));
        const mysqlEmails: any[] = await queryMysql(`SELECT email FROM perfiles_registrados WHERE email IN (${uniqueEmails.map(() => '?').join(',')})`, uniqueEmails);
        mysqlEmails.forEach(r => registeredEmails.add(r.email.toLowerCase().trim()));
    }

    // 3. Enriquecer órdenes
    const enrichedOrders = orders.map(o => {
        const email = o.email?.toLowerCase().trim();
        const isRegistered = o.azure_reg || registeredFolios.has(o.folio) || (email && registeredEmails.has(email));
        return {
            ...o,
            registro: isRegistered ? 'Registrado' : 'No Registrado'
        };
    });

    // 4. KPIs
    const totalVenta = enrichedOrders.reduce((sum, o) => sum + Number(o.venta_importe || 0), 0);
    const totalOrdenes = enrichedOrders.length;
    const totalRegistrados = enrichedOrders.filter(o => o.registro === 'Registrado').length;
    const ticketPromedio = totalOrdenes > 0 ? totalVenta / totalOrdenes : 0;
    const tasaConversion = totalOrdenes > 0 ? (totalRegistrados / totalOrdenes) * 100 : 0;

    return NextResponse.json({
      seller: {
        name: sellerName,
        totalVenta,
        totalOrdenes,
        totalRegistrados,
        ticketPromedio,
        tasaConversion
      },
      orders: enrichedOrders
    });

  } catch (err: any) {
    console.error('[/api/admin/sellers/[name]]', err);
    return NextResponse.json({ error: 'Error del servidor', detail: err.message }, { status: 500 });
  }
}
