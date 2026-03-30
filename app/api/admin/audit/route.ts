import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get('inicio') || '2024-01-01';
  const fechaFin = searchParams.get('fin') || '2026-12-31';

  try {
    // We fetch a flat list of emails from Azure POS to find collusion and global trends
    const azureEmails = await queryAzure<any>(`
      SELECT o.folio, o.external_creation_date as orderDate, o.email, s.name as vendedor
      FROM dbo.orders o
      JOIN dbo.sellers s ON o.seller_id = s.id
      WHERE o.email IS NOT NULL AND o.external_creation_date >= @inicio AND o.external_creation_date <= @fin
    `, {
      inicio: fechaInicio,
      fin: fechaFin + 'T23:59:59.999Z'
    });

    // 1. Detección de Colusión (Correo compartido entre vendedores)
    const emailToSellers = new Map<string, Set<string>>();
    // 2. Detección de Spoofing MASIVO (Prefijo con multiples dominios)
    const prefixToDomains = new Map<string, Set<string>>();
    // 3. Velocidad Anormal
    const velocityMap = new Map<string, any>();
    
    // 4. Anomaly Scores por Vendedor
    const sellerStats = new Map<string, { total: number; prefixes: Set<string>; isRed: boolean }>();

    azureOrdersLoop: for (const o of azureEmails) {
      const rawEmail = o.email?.toLowerCase().trim();
      if (!rawEmail || rawEmail.length < 5 || !rawEmail.includes('@')) continue;

      const prefix = rawEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
      const domain = rawEmail.split('@')[1];
      const sellerRaw = o.vendedor || 'Desconocido';

      if (prefix.length < 3) continue;

      // Seller Stats (para armar ranking de riesgo alto directo)
      if (!sellerStats.has(sellerRaw)) sellerStats.set(sellerRaw, { total: 0, prefixes: new Set(), isRed: false });
      const stats = sellerStats.get(sellerRaw)!;
      stats.total++;
      stats.prefixes.add(prefix);

      // Collusion Network
      if (!emailToSellers.has(rawEmail)) emailToSellers.set(rawEmail, new Set());
      emailToSellers.get(rawEmail)!.add(sellerRaw);

      // Mass Spoofing
      if (!prefixToDomains.has(prefix)) prefixToDomains.set(prefix, new Set());
      prefixToDomains.get(prefix)!.add(domain);

      // Velocity (mismo correo, mismo dia)
      const daykey = rawEmail + '|' + new Date(o.orderDate).toISOString().split('T')[0] + '|' + sellerRaw;
      if (!velocityMap.has(daykey)) {
        velocityMap.set(daykey, { vendedor: sellerRaw, correo: rawEmail, qty: 0 });
      }
      velocityMap.get(daykey)!.qty++;
    }

    // Process output
    const globalClusters = Array.from(emailToSellers.entries())
      .filter(([_, sellers]) => sellers.size > 1)
      .map(([correo, sellers]) => ({
        correo,
        sellers_count: sellers.size,
        sellers_list: Array.from(sellers).join(', ')
      }))
      .sort((a, b) => b.sellers_count - a.sellers_count)
      .slice(0, 50);

    const massSpoofing = Array.from(prefixToDomains.entries())
      .filter(([_, doms]) => doms.size > 1)
      .map(([prefix, doms]) => ({
        prefijo: prefix,
        dominios_qty: doms.size,
        dominios_list: Array.from(doms).join(', ')
      }))
      .sort((a, b) => b.dominios_qty - a.dominios_qty)
      .slice(0, 50);

    const velocityAlerts = Array.from(velocityMap.values())
      .filter(v => v.qty > 3) // More than 3 same emails by same seller in 1 day
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 50);

    const sellerScores = Array.from(sellerStats.entries())
      .map(([vendedor, s]) => {
        const ratio = s.total > 0 ? (1 - (s.prefixes.size / s.total)) * 100 : 0;
        return {
          vendedor,
          total_registros: s.total, // Azure tickets with email
          anomaly_ratio: ratio
        };
      })
      .filter(s => s.anomaly_ratio > 30) // Only return suspicious sellers
      .sort((a, b) => b.anomaly_ratio - a.anomaly_ratio);

    return NextResponse.json({
      globalClusters,
      massSpoofing,
      velocityAlerts,
      sellerScores
    });
  } catch (err: any) {
    console.error('[/api/admin/audit] Azure Global Audit', err);
    return NextResponse.json({ error: 'Error de auditoría', detail: err.message }, { status: 500 });
  }
}
