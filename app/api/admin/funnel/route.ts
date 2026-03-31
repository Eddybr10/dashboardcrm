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
    // 1. Get Azure orders in period with more details
    let azureSql = `
      SELECT o.email, o.folio, CAST(o.external_creation_date AS DATE) as fecha, o.total as monto, l.name as tienda
      FROM dbo.orders o
      INNER JOIN dbo.locations l ON o.location_id = l.id
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
      .map((o: any) => o.email.trim().toLowerCase());
    
    const uniqueEmails = Array.from(new Set(validEmails));

    // 3. Match with MySQL perfiles_registrados (fast lookup)
    let registeredProfiles: any[] = [];
    if (uniqueEmails.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < uniqueEmails.length; i += batchSize) {
        const batch = uniqueEmails.slice(i, i + batchSize);
        const mysqlRows = await queryMysql<any>(
          `SELECT email, rfm_totalPurchases FROM perfiles_registrados WHERE LOWER(email) IN (?)`,
          [batch]
        );
        registeredProfiles = [...registeredProfiles, ...mysqlRows];
      }
    }

    const regMap = new Map();
    registeredProfiles.forEach(p => {
      regMap.set(p.email.trim().toLowerCase(), p);
    });

    // 4. Universal Fallback to Guper API for ALL unique emails
    if (uniqueEmails.length > 0) {
      const gBatchSize = 15;
      for (let i = 0; i < uniqueEmails.length; i += gBatchSize) {
        const batch = uniqueEmails.slice(i, i + gBatchSize);
        const emailsToFetch = batch.filter(e => !regMap.has(e));
        
        if (emailsToFetch.length > 0) {
          const guperResults = await Promise.all(
            emailsToFetch.map(async (email) => {
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
                  rfm_totalPurchases: profile.rfm?.totalPurchases || 1 
                };
              }
              return null;
            })
          );
          guperResults.forEach(p => {
            if (p) {
              regMap.set(p.originalQuery.trim().toLowerCase(), p);
              regMap.set(p.email.trim().toLowerCase(), p);
            }
          });
        }
      }
    }

    // 5. Aggregate totals & Build detailed list
    const totalTickets = orders.length;
    const ticketsValidos = validEmails.length;
    
    let recompras = 0;
    let registrados = 0;
    const detailedOrders: any[] = [];

    orders.forEach((o: any) => {
      const email = o.email?.trim().toLowerCase();
      const fechaStr = o.fecha.toISOString().split('T')[0];
      
      let clientName = 'N/A';
      let status = 'N/A';
      let foundEmail = '';

      if (email) {
        const profil = regMap.get(email);
        const isRegistered = profil && (profil.hasTag119 !== undefined ? profil.hasTag119 : true);
        
        if (profil) {
          foundEmail = profil.email;
          clientName = `${profil.firstName || ''} ${profil.lastName || ''}`.trim() || 'Desconocido';
          
          if (isRegistered) {
            // Logic Fix: Mutually exclusive categorization
            const isRecompra = profil.rfm_totalPurchases > 1;
            if (isRecompra) {
              recompras++;
              status = 'RECOMPRA';
            } else {
              registrados++;
              status = 'REGISTRADO';
            }
          } else {
            status = '⛔ Sin Registro';
          }
        }
      }

      detailedOrders.push({
        folio: o.folio,
        fecha: fechaStr,
        tienda: o.tienda,
        monto: o.monto,
        emailOriginal: o.email || '',
        emailEncontrado: foundEmail,
        cliente: clientName,
        estado: status
      });
    });

    return NextResponse.json({
      summary: {
        totalTickets,
        ticketsValidos,
        recompras,
        registrados
      },
      detailedOrders
    });

  } catch (err: any) {
    console.error('[Funnel API Error]', err);
    return NextResponse.json({ error: 'Falla al procesar embudo', details: err.message }, { status: 500 });
  }
}
