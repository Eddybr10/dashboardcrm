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
    // 1. Get Azure orders in period
    let azureSql = `
      SELECT o.email, o.folio, CAST(o.external_creation_date AS DATE) as fecha
      FROM dbo.orders o
      WHERE CAST(o.external_creation_date AS DATE) >= @inicio 
        AND CAST(o.external_creation_date AS DATE) <= @fin
    `;
    const params: any = { inicio, fin };

    if (locationId && locationId !== 'all') {
      azureSql += ` AND o.location_id = @locationId`;
      params.locationId = locationId;
    }

    const orders = await queryAzure<any>(azureSql, params);

    // 2. Extract unique emails
    const validEmails = orders
      .filter((o: any) => o.email && o.email.includes('@'))
      .map((o: any) => o.email.toLowerCase());
    
    const uniqueEmails = Array.from(new Set(validEmails));

    // 3. Match with MySQL perfiles_registrados
    let registeredProfiles: any[] = [];
    if (uniqueEmails.length > 0) {
      // Small optimization: limit chunk size for IN clause
      const batchSize = 1000;
      for (let i = 0; i < uniqueEmails.length; i += batchSize) {
        const batch = uniqueEmails.slice(i, i + batchSize);
        const mysqlRows = await queryMysql<any>(
          `SELECT email, rfm_totalPurchases FROM perfiles_registrados WHERE LOWER(email) IN (?)`,
          [batch.map(e => e.toLowerCase())]
        );
        registeredProfiles = [...registeredProfiles, ...mysqlRows];
      }
    }

    const regMap = new Map(registeredProfiles.map(p => [p.email.toLowerCase(), p]));

    // 4. Aggregate totals
    const totalTickets = orders.length;
    const ticketsValidos = validEmails.length;
    
    let recompras = 0;
    let registrados = 0;

    orders.forEach((o: any) => {
      if (o.email) {
        const profil = regMap.get(o.email.toLowerCase());
        if (profil) {
          registrados++;
          if (profil.rfm_totalPurchases > 1) {
            recompras++;
          }
        }
      }
    });

    return NextResponse.json({
      summary: {
        totalTickets,
        ticketsValidos,
        recompras,
        registrados
      },
      // Maybe add daily breakdown?
      daily: [] 
    });

  } catch (err: any) {
    console.error('[Funnel API Error]', err);
    return NextResponse.json({ error: 'Falla al procesar embudo', details: err.message }, { status: 500 });
  }
}
