import { NextRequest, NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';
import { getGuperCustomerByEmail } from '@/lib/guper';

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

    // 2. Identify unique emails and missing emails to enrich
    const allEmails = Array.from(new Set(orders
      .map((o: any) => o.email?.trim().toLowerCase())
      .filter(Boolean) as string[]
    ));
    
    // 3. Lookup in MySQL perfiles_registrados
    let profilesByEmail: any[] = [];
    if (allEmails.length > 0) {
      profilesByEmail = await queryMysql<any>(
        `SELECT firstName, lastName, email, cellphone, rfm_totalPurchases FROM perfiles_registrados WHERE LOWER(email) IN (?)`,
        [allEmails]
      );
    }

    const emailMap = new Map();
    profilesByEmail.forEach(p => {
      emailMap.set(p.email.trim().toLowerCase(), p);
    });

    // 4. Universal Fallback to Guper API for ALL unique emails (Primary source for status)
    if (allEmails.length > 0) {
      const batchSize = 10; // Batching to prevent swamping the API
      for (let i = 0; i < allEmails.length; i += batchSize) {
        const batch = allEmails.slice(i, i + batchSize);
        
        const guperResults = await Promise.all(
          batch.map(async (email) => {
            const profile = await getGuperCustomerByEmail(email.trim());
            if (profile) {
              const tags = Array.isArray(profile.tags) ? profile.tags : [];
              const hasTag119 = tags.some((t: any) => t.tag === 119);

              return {
                originalQuery: email,
                email: profile.email,
                firstName: profile.firstName || profile.name || '',
                lastName: profile.lastName || '',
                hasTag119,
                rfm_totalPurchases: profile.rfm?.totalPurchases || 1,
                source: 'guper'
              };
            }
            return null;
          })
        );

        guperResults.forEach(p => {
          if (p) {
            emailMap.set(p.originalQuery.trim().toLowerCase(), p);
            emailMap.set(p.email.trim().toLowerCase(), p);
          }
        });
      }
    }

    // 5. Format CSV
    const csvRows = [
      ['Folio', 'Fecha', 'Tienda', 'Monto', 'Email Original', 'Email Encontrado', 'Cliente', 'Estado'],
    ];

    orders.forEach((o: any) => {
      const emailKey = o.email?.trim().toLowerCase();
      let foundProfile = emailKey ? emailMap.get(emailKey) : null;
      
      let estado = 'N/A';
      if (foundProfile && foundProfile.hasTag119) {
        estado = foundProfile.rfm_totalPurchases > 1 ? 'RECOMPRA' : 'REGISTRADO';
      } else if (foundProfile) {
        estado = '⛔ Sin Registro (No Tag 119)';
      }

      csvRows.push([
        o.folio,
        o.external_creation_date.toISOString().split('T')[0],
        o.tienda,
        o.total,
        o.email || '',
        foundProfile ? foundProfile.email : '',
        foundProfile ? `${foundProfile.firstName} ${foundProfile.lastName}`.trim() : 'N/A',
        estado
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
