import { NextRequest, NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';
import { getGuperCustomerByEmail } from '@/lib/guper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email requerido' }, { status: 400 });
  }

  try {
    // 1. Buscar perfil en Guper API (fuente principal)
    let profile = null;
    let source = '';

    const guperProfile = await getGuperCustomerByEmail(email.trim());
    if (guperProfile) {
      // Normalizar para que coincida con la estructura de MySQL
      profile = {
        id: guperProfile.id,
        name: guperProfile.name || `${guperProfile.firstName || ''} ${guperProfile.lastName || ''}`.trim(),
        email: guperProfile.email,
        cellphone: guperProfile.cellphone,
        gender: guperProfile.gender,
        postalCode: guperProfile.postalCode,
        dateOfBirth: guperProfile.dateOfBirth,
        createdAt: guperProfile.createdAt,
        rfm_totalPurchaseValue: guperProfile.rfm?.totalPurchaseValue,
        rfm_totalPurchases: guperProfile.rfm?.totalPurchases,
        rfm_daysWithoutPurchase: guperProfile.rfm?.daysWithoutPurchase,
        tags: guperProfile.tags?.map((t: any) => t.tag).join(', ')
      };
      source = 'guper_api';
    }

    // 2. Si Guper no tiene, buscar en MySQL perfiles_registrados
    if (!profile) {
      const mysqlProfiles = await queryMysql(
        `SELECT id, name, email, cellphone, gender, postalCode, dateOfBirth,
                validatedAt, rfm_totalPurchaseValue, rfm_totalPurchases,
                rfm_daysWithoutPurchase, tags, createdAt
         FROM perfiles_registrados WHERE email = ? LIMIT 1`,
        [email.trim()]
      );
      if (mysqlProfiles.length > 0) {
        profile = mysqlProfiles[0];
        source = 'mysql';
      }
    }

    // 3. Buscar historial de órdenes en MySQL
    const ordenes = await queryMysql(
      `SELECT id, folio, email, tienda, clientenetsuite, created_date
       FROM orders_netsuite WHERE email = ? ORDER BY id DESC LIMIT 30`,
      [email.trim()]
    );

    // 4. Buscar registros del cliente
    const registros = await queryMysql(
      `SELECT id, categoria, folio, email, estado, fecha, fechaBase, tienda, zona, tipo
       FROM registrados WHERE email = ? ORDER BY id DESC LIMIT 20`,
      [email.trim()]
    );

    return NextResponse.json({ profile, source, ordenes, registros });
  } catch (err) {
    console.error('[/api/admin/customers]', err);
    return NextResponse.json({ error: 'Error al buscar cliente' }, { status: 500 });
  }
}
