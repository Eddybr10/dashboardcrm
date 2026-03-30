import { NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';

export async function GET() {
  try {
    const locations = await queryAzure(`
      SELECT DISTINCT l.id, l.name
      FROM dbo.locations l
      JOIN dbo.orders o ON l.id = o.location_id
      ORDER BY l.name ASC
    `);
    return NextResponse.json(locations);
  } catch (err: any) {
    return NextResponse.json({ error: 'Falla al cargar sucursales', details: err.message }, { status: 500 });
  }
}
