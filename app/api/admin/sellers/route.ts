import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio');
  const fechaFin = searchParams.get('fin');

  if (!fechaInicio || !fechaFin) {
    return NextResponse.json({ error: 'inicio y fin requeridos' }, { status: 400 });
  }

  try {
    // 1. Obtener todas las órdenes y folios del periodo desde Azure (Fuente de Verdad de Ventas)
    const azureOrders = await queryAzure<any>(
      `SELECT 
        s.name as vendedor,
        o.folio,
        o.email,
        CAST(o.total AS DECIMAL(18,2)) as total,
        rg.sync_id as azure_reg
       FROM dbo.orders o
       JOIN dbo.sellers s ON o.seller_id = s.id
       LEFT JOIN dbo.REGISTROS_GUPER rg ON o.id = rg.order_id
       WHERE o.external_creation_date BETWEEN @inicio AND @fin
         AND s.name IS NOT NULL AND s.name != ''`,
      { inicio: fechaInicio, fin: fechaFin }
    );

    if (azureOrders.length === 0) return NextResponse.json({ sellers: [] });

    // 2. TRIPLE CHECK: Folio en MySQL | Email en CRM Global
    const azureFolios = azureOrders.map(o => o.folio);
    const azureEmails = azureOrders.map(o => o.email?.toLowerCase().trim()).filter(e => e && e.length > 3);

    const registeredFolios = new Set<string>();
    const registeredEmails = new Set<string>();

    // Chunking para evitar límites de IN (?)
    const chunkSize = 500;
    
    // Check Folios en registrados
    for (let i = 0; i < azureFolios.length; i += chunkSize) {
        const chunk = azureFolios.slice(i, i + chunkSize);
        const mysqlFolios: any[] = await queryMysql(`SELECT folio FROM registrados WHERE folio IN (${chunk.map(() => '?').join(',')})`, chunk);
        mysqlFolios.forEach(r => registeredFolios.add(r.folio));
    }

    // Check Emails en perfiles_registrados
    if (azureEmails.length > 0) {
        const uniqueEmails = Array.from(new Set(azureEmails));
        for (let i = 0; i < uniqueEmails.length; i += chunkSize) {
            const chunk = uniqueEmails.slice(i, i + chunkSize);
            const mysqlEmails: any[] = await queryMysql(`SELECT email FROM perfiles_registrados WHERE email IN (${chunk.map(() => '?').join(',')})`, chunk);
            mysqlEmails.forEach(r => registeredEmails.add(r.email.toLowerCase().trim()));
        }
    }

    // 3. Agrupar por vendedor y calcular totales con TRIPLE CHECK + AZURE FRAUD DETECT
    const sellerStats: Record<string, any> = {};

    azureOrders.forEach(o => {
      if (!sellerStats[o.vendedor]) {
        sellerStats[o.vendedor] = { 
            vendedor: o.vendedor, 
            ubicacion: o.tienda,
            total_ordenes: 0, 
            venta_total: 0, 
            clientes_registrados: 0,
            correos_unicos: new Set(),
            prefijos_unicos: new Set()
        };
      }
      
      const stats = sellerStats[o.vendedor];
      stats.total_ordenes += 1;
      stats.venta_total += Number(o.total || 0);

      const email = o.email?.toLowerCase().trim();
      
      if (email) {
        stats.correos_unicos.add(email);
        const prefix = email.split('@')[0].replace(/[^a-z0-9]/g, ''); // Normalización severa
        if (prefix.length > 2) stats.prefijos_unicos.add(prefix);
      }

      const isRegistered = o.azure_reg || registeredFolios.has(o.folio) || (email && registeredEmails.has(email));
      
      if (isRegistered) {
        stats.clientes_registrados += 1;
      }
    });

    const finalSellers = Object.values(sellerStats)
      .sort((a, b) => b.venta_total - a.venta_total)
      .slice(0, 50)
      .map(s => {
        const correosCapturados = s.correos_unicos.size;
        const totalOrdenes = s.total_ordenes;
        
        let anomalyRatio = 0;
        if (totalOrdenes > 0 && correosCapturados > 0) {
           // Si un vendedor captura 10 correos puros en 100 ordenes, ¿cuántos son Spoofed?
           const spoofedCount = correosCapturados - s.prefijos_unicos.size; 
           // Penalización: Mientras menos prefijos únicos respecto a los correos totales, más probabilidad de spoofing.
           // Penalizamos si capturan pocos correos para el volumen de sus órdenes (Stuffing severo: 1 correo para 50 ordenes)
           const repeticionCruda = totalOrdenes > 0 ? (1 - (s.prefijos_unicos.size / totalOrdenes)) * 100 : 0;
           anomalyRatio = repeticionCruda;
        }

        return {
            ...s,
            anomaly_ratio: Math.max(0, anomalyRatio),
            clientes_no_registrados: Math.max(0, s.total_ordenes - s.clientes_registrados)
        }
      });

    return NextResponse.json({ sellers: finalSellers });
  } catch (err) {
    console.error('[/api/admin/sellers]', err);
    return NextResponse.json({ error: 'Error de base de datos', detail: String(err) }, { status: 500 });
  }
}
