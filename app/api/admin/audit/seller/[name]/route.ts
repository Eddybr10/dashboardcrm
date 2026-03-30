import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = await paramsPromise;
  const sellerName = decodeURIComponent(params.name);

  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2024-01-01';
  const fechaFin = searchParams.get('fin') || '2026-12-31';

  try {
    // 1. Raw Azure Orders for this seller using Exact Match
    // 1. Raw Azure Orders + Guper Link for this seller using Exact Match
    // 1. Raw Azure Orders + Guper Link + Coupon Abuse for this seller using Exact Match
    const azureOrders = await queryAzure<any>(`
      SELECT 
        o.id, 
        o.folio, 
        o.external_creation_date as orderDate, 
        o.email, 
        o.total, 
        s.name as vendedor, 
        rg.sync_id as azure_reg,
        c.discount_total,
        c.coupon_code
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      LEFT JOIN dbo.REGISTROS_GUPER rg ON o.id = rg.order_id
      LEFT JOIN (
         SELECT order_id, SUM(value) as discount_total, MAX(code) as coupon_code 
         FROM dbo.coupons 
         GROUP BY order_id
      ) c ON o.id = c.order_id
      WHERE s.name = @name AND o.external_creation_date >= @inicio AND o.external_creation_date <= @fin
      ORDER BY o.external_creation_date DESC
    `, {
      name: sellerName,
      inicio: fechaInicio,
      fin: fechaFin + 'T23:59:59.999Z'
    });

    // 2. Process exact stuffing & domain spoofing in memory (Azure POS focus)
    const exactEmails = new Map<string, any>();
    const emailPrefixes = new Map<string, any>();
    let totalCapturados = 0;

    azureOrders.forEach(o => {
      const email = o.email?.toLowerCase().trim() || '';
      if (email.length > 3 && email.includes('@')) {
        totalCapturados++;
        
        // Exact Emails (Stuffing)
        if (!exactEmails.has(email)) {
           exactEmails.set(email, { correo: email, qty: 0, folios: new Set() });
        }
        const exact = exactEmails.get(email);
        exact.qty++;
        exact.folios.add(o.folio);

        // Prefixes (Spoofing)
        const prefix = email.split('@')[0].replace(/[^a-z0-9]/g, '');
        if (prefix.length > 2) {
          if (!emailPrefixes.has(prefix)) {
             emailPrefixes.set(prefix, { prefijo: prefix, count: 0, variantes: new Set() });
          }
          const p = emailPrefixes.get(prefix);
          p.count++;
          p.variantes.add(email);
        }
      }
    });

    const emailClusters = Array.from(exactEmails.values())
      .filter(e => e.qty > 1)
      .sort((a, b) => b.qty - a.qty)
      .map(e => ({ ...e, folios: Array.from(e.folios).join(', ') }));

    const spoofingAlerts = Array.from(emailPrefixes.values())
      .filter(p => p.variantes.size > 1) // Used same prefix to fake different emails
      .sort((a, b) => b.count - a.count)
      .map(p => ({ ...p, variantes: Array.from(p.variantes).join(', ') }));

    // Real multiplexados no existen en POS ticket-1-correo, pero sí Spoofing de alto riesgo
    const resumen = {
      total_registros: azureOrders.length, // total POS tickets
      correos_capturados: totalCapturados,
      correos_unicos: exactEmails.size,
      prefijos_unicos: emailPrefixes.size,
      spoofing_cases: spoofingAlerts.length
    };

    // Fetch Payments and Products in batches to build the 360º view without complex JOIN explosion
    const orderIds = azureOrders.map(o => o.id);
    const paymentsRaw = orderIds.length > 0 ? await queryAzure<any>(`
      SELECT order_id, STRING_AGG(description, ', ') as metodos
      FROM dbo.payments
      WHERE order_id IN (${orderIds.join(',')})
      GROUP BY order_id
    `) : [];
    
    const productsRaw = orderIds.length > 0 ? await queryAzure<any>(`
      SELECT p.order_id, STRING_AGG(ISNULL(i.sku, 'ITEM_EXTRA'), ', ') as skus
      FROM dbo.products p
      LEFT JOIN dbo.items i ON p.external_item_id = i.external_id
      WHERE p.order_id IN (${orderIds.join(',')})
      GROUP BY p.order_id
    `) : [];

    // Map order ID references
    const paymentMap = new Map();
    paymentsRaw.forEach(p => paymentMap.set(p.order_id, p.metodos));

    const productMap = new Map();
    productsRaw.forEach(p => productMap.set(p.order_id, p.skus));

    // Riesgo Financiero: Evaluar robos potenciales
    let cupones_sospechosos = 0;
    
    const historial = azureOrders.map(o => {
      const isAutoRegistro = o.email && o.email.length > 3 && sellerName.toLowerCase().replace(/[^a-z]/g, '').includes(o.email.split('@')[0].toLowerCase().replace(/[^a-z]/g, ''));
      const hasCoupon = !!o.coupon_code;
      if (hasCoupon) cupones_sospechosos++;

      const dateObj = o.orderDate ? new Date(o.orderDate) : null;

      return {
        folio: o.folio,
        fecha: dateObj ? dateObj.toLocaleDateString() : '-',
        hora: dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        total: o.total,
        email: o.email || '-',
        guper: !!o.azure_reg,
        cupon: o.coupon_code || null,
        descuento: o.discount_total || 0,
        pagos: paymentMap.get(o.id) || 'N/D',
        skus: productMap.get(o.id) || 'Sin Desc',
        alarma_autoregistro: isAutoRegistro,
        alarma_robo: hasCoupon && (!o.email || o.email.length < 5) 
      };
    });

    return NextResponse.json({
      seller: sellerName,
      emailClusters,
      spoofingAlerts,
      summary: { ...resumen, cupones_sospechosos },
      historial
    });

  } catch (err: any) {
    console.error('[/api/admin/audit/seller/[name]] Azure', err);
    return NextResponse.json({ error: 'Error de expediente Azure', detail: err.message }, { status: 500 });
  }
}
