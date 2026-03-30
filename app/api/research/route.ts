import { NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET() {
  const GUPER_BASE_URL = process.env.GUPER_BASE_URL;
  const GUPER_TOKEN = process.env.GUPER_TOKEN;
  const email = 'eddy201222@hotmail.com';
  const url = `${GUPER_BASE_URL}/register/customer?q[email]=${encodeURIComponent(email)}`;

  const resGuper = await fetch(url, {
    headers: {
      "x-guper-authorization": `Bearer ${GUPER_TOKEN}`,
      "Content-Type": "application/json",
    }
  });
  const guperStatus = resGuper.status;
  const guperData = await resGuper.json();

  const rows = await queryMysql('SELECT * FROM ordenes_enriquecidas LIMIT 1');
  const columns = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0] as object) : [];

  return NextResponse.json({
    guper: { status: guperStatus, data: guperData },
    mysql: { columns }
  });
}
