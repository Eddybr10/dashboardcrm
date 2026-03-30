import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    // 1. Segmentación de Clientes por Valor (RFM Global)
    const topSpenders = await queryMysql<any>(
      `SELECT name, email, rfm_totalPurchaseValue as value, rfm_totalPurchases as frequency, rfm_lastPurchaseDate as last_seen
       FROM perfiles_registrados
       WHERE rfm_totalPurchaseValue > 0
       ORDER BY rfm_totalPurchaseValue DESC LIMIT 50`
    );

    // 2. Frecuencia de Compra
    const frequentBuyers = await queryMysql<any>(
      `SELECT name, email, rfm_totalPurchases as frequency, rfm_totalPurchaseValue as value
       FROM perfiles_registrados
       WHERE rfm_totalPurchases > 1
       ORDER BY rfm_totalPurchases DESC LIMIT 50`
    );

    // 3. Valor Promedio por Tienda (Usando store ref en perfiles si existe)
    const storeLoyalty = await queryMysql<any>(
      `SELECT store as store_id, COUNT(*) as loyal_customers, 
              SUM(rfm_totalPurchaseValue) as total_store_value,
              AVG(rfm_totalPurchaseValue) as avg_customer_value
       FROM perfiles_registrados
       WHERE store != '' AND store != '0'
       GROUP BY store
       ORDER BY total_store_value DESC LIMIT 20`
    );

    return NextResponse.json({ topSpenders, frequentBuyers, storeLoyalty });

  } catch (err: any) {
    console.error('[/api/admin/loyalty]', err);
    return NextResponse.json({ error: 'Error de fidelización', detail: err.message }, { status: 500 });
  }
}
