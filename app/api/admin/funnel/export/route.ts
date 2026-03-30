import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicio = searchParams.get('inicio');
  const fin = searchParams.get('fin');
  const locationId = searchParams.get('locationId');

  if (!inicio || !fin) {
    return NextResponse.json({ error: 'Rango de fechas es obligatorio' }, { status: 400 });
  }

  try {
    // 1. Fetch Orders from Azure
    let sql = `
      SELECT o.id, o.folio, o.email, o.total, o.external_creation_date, l.name as tienda, a.phone
      FROM dbo.orders o
      LEFT JOIN dbo.locations l ON o.location_id = l.id
      LEFT JOIN dbo.addresses a ON o.id = a.order_id
      WHERE CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
    `;
    const params: any = { inicio, fin };

    if (locationId && locationId !== 'all') {
      sql += ` AND o.location_id = @locationId`;
      params.locationId = locationId;
    }

    const orders = await queryAzure<any>(sql, params);

    // 2. Identify missing emails to enrich via Phone
    const missingEmailOrders = orders.filter((o: any) => !o.email && o.phone);
    const phonesToLookup = Array.from(new Set(missingEmailOrders.map((o: any) => o.phone.replace(/[^\d]/g, '').slice(-10))));

    // 3. Lookup in MySQL perfiles_registrados by Email OR Phone
    const emailsToLookup = orders.filter((o: any) => o.email).map((o: any) => o.email);
    
    // Enriching logic: batch queries
    let profilesByEmail: any[] = [];
    let profilesByPhone: any[] = [];

    if (emailsToLookup.length > 0) {
      profilesByEmail = await queryMysql<any>(
        `SELECT firstName, lastName, email, cellphone, rfm_totalPurchases FROM perfiles_registrados WHERE LOWER(email) IN (?)`,
        [emailsToLookup.map(e => e.toLowerCase())]
      );
    }

    // Attempt phone enrichment
    if (phonesToLookup.length > 0) {
      profilesByPhone = await queryMysql<any>(
        `SELECT firstName, lastName, email, cellphone, rfm_totalPurchases FROM perfiles_registrados WHERE RIGHT(cellphone, 10) IN (?)`,
        [phonesToLookup]
      );
    }

    const emailMap = new Map(profilesByEmail.map(p => [p.email.toLowerCase(), p]));
    const phoneMap = new Map(profilesByPhone.map(p => [(p.cellphone || '').replace(/[^\d]/g, '').slice(-10), p]));

    // 4. Enrich orders and format CSV
    const csvRows = [
      ['Folio', 'Fecha', 'Tienda', 'Monto', 'Email Original', 'Email Encontrado', 'Cliente', 'Estado'],
    ];

    orders.forEach((o: any) => {
      let foundProfile = o.email ? emailMap.get(o.email.toLowerCase()) : null;
      
      // Fallback enrichment by phone
      if (!foundProfile && o.phone) {
        const cleanPhone = o.phone.replace(/[^\d]/g, '').slice(-10);
        foundProfile = phoneMap.get(cleanPhone);
      }

      csvRows.push([
        o.folio,
        o.external_creation_date.toISOString().split('T')[0],
        o.tienda,
        o.total,
        o.email || '',
        foundProfile ? foundProfile.email : '',
        foundProfile ? `${foundProfile.firstName} ${foundProfile.lastName}` : 'N/A',
        foundProfile ? (foundProfile.rfm_totalPurchases > 1 ? 'RECOMPRA' : 'REGISTRADO') : 'N/A'
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="funnel_export_${inicio}_${fin}.csv"`
      }
    });

  } catch (err: any) {
    console.error('[Export Error]', err);
    return NextResponse.json({ error: 'Falla al generar exportación', details: err.message }, { status: 500 });
  }
}
