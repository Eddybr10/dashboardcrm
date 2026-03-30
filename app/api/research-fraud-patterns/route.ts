import { NextResponse } from 'next/server';
import { queryMysql } from '@/lib/mysql';

export async function GET() {
  try {
    // 1. Identify worst offenders: Sellers with multiple folios for the SAME email
    const offenders = await queryMysql<any>(
      `SELECT vendedor, correo, COUNT(DISTINCT folio) as folios_count, GROUP_CONCAT(folio) as folios
       FROM ordenes_enriquecidas 
       WHERE correo != '' AND vendedor != ''
       GROUP BY vendedor, correo 
       HAVING folios_count > 1 
       ORDER BY folios_count DESC LIMIT 20`
    );

    // 2. Identify "Global Fraud": Emails used across DIFFERENT sellers
    const globalFraud = await queryMysql<any>(
      `SELECT correo, COUNT(DISTINCT vendedor) as vendedores_count, GROUP_CONCAT(DISTINCT vendedor) as vendedores
       FROM ordenes_enriquecidas 
       WHERE correo != ''
       GROUP BY correo 
       HAVING vendedores_count > 1 
       ORDER BY vendedores_count DESC LIMIT 20`
    );

    return NextResponse.json({ offenders, globalFraud });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
