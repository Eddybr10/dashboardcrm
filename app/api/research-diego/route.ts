import { NextResponse } from 'next/server';
import { queryAzure } from '@/lib/azure';
import { queryMysql } from '@/lib/mysql';

export async function GET() {
  try {
    // 1. Get Diego's orders from Azure
    const azureOrders = await queryAzure<any>(
      `SELECT TOP 10 o.folio, o.email FROM dbo.orders o 
       JOIN dbo.sellers s ON o.seller_id = s.id 
       WHERE s.name LIKE '%DIEGO ALEJANDRO%'`
    );
    
    if (azureOrders.length === 0) return NextResponse.json({ error: 'No Diego found' });
    
    const folios = azureOrders.map(o => o.folio);
    const emails = azureOrders.map(o => o.email);

    // 2. Check in MySQL report_summary
    const mysqlReport = await queryMysql(
      `SELECT * FROM report_summary WHERE folio IN (${folios.map(() => '?').join(',')})`,
      folios
    );

    // 3. Check in MySQL perfiles_registrados
    const mysqlProfiles = await queryMysql(
      `SELECT email FROM perfiles_registrados WHERE email IN (${emails.map(() => '?').join(',')})`,
      emails
    );

    return NextResponse.json({ azureOrders, mysqlReport, mysqlProfiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
