import { NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';
import { getGuperCustomerByEmail } from '@/lib/guper';

export async function GET() {
  const email = 'eddy201222@hotmail.com';
  const guperData = await getGuperCustomerByEmail(email);
  const guperStatus = guperData ? 200 : 404;

  const rows = await queryMysql('SELECT * FROM ordenes_enriquecidas LIMIT 1');
  const columns = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0] as object) : [];

  return NextResponse.json({
    guper: { status: guperStatus, data: guperData },
    mysql: { columns }
  });
}
