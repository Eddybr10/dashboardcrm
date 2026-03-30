'use client';
import { useState, useEffect } from 'react';
import { Heart, Crown, Zap, MapPin, Search, Star } from 'lucide-react';
import ExportButton from '@/components/ExportButton';

export default function LoyaltyDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  async function fetchLoyaltyData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/loyalty');
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchLoyaltyData(); }, []);

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Heart size={22} fill="var(--red)" stroke="var(--red)" />
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>Fidelización de Clientes</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Análisis RFM (Recencia, Frecuencia, Valor Monetario) del CRM</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Big Spenders */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crown size={16} color="var(--yellow)" /> High-Value Customers (LTV)
            </div>
            <ExportButton data={data?.topSpenders || []} filename="clientes_alto_valor" />
          </div>
          <table className="crm-table">
            <thead><tr><th>Cliente</th><th style={{ textAlign: 'center' }}>Frecuencia</th><th style={{ textAlign: 'right' }}>LTV Total</th></tr></thead>
            <tbody>
              {data?.topSpenders?.map((row: any) => (
                <tr key={row.email}>
                  <td style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{row.name || 'Cliente Cloe'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.email}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}><span className="badge badge-yellow">{row.frequency} compras</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(row.value).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Frecuencia */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} /> Clientes Recurrentes
            </div>
            <ExportButton data={data?.frequentBuyers || []} filename="clientes_recurrentes" />
          </div>
          <table className="crm-table">
            <thead><tr><th>Nombre</th><th style={{ textAlign: 'center' }}>Visitas</th><th style={{ textAlign: 'right' }}>Gasto Acum.</th></tr></thead>
            <tbody>
              {data?.frequentBuyers?.map((row: any) => (
                <tr key={row.email}>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{row.name || row.email}</td>
                  <td style={{ textAlign: 'center' }}><span className="badge badge-green">{row.frequency}</span></td>
                  <td style={{ textAlign: 'right' }}>${Number(row.value).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Valor por Tienda */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={16} /> Tiendas con Clientes de Mayor Valor
          </div>
          <ExportButton data={data?.storeLoyalty || []} filename="fidelidad_por_tienda" />
        </div>
        <table className="crm-table">
          <thead><tr><th>ID Tienda (Guper)</th><th style={{ textAlign: 'center' }}>Base de Clientes Leales</th><th style={{ textAlign: 'right' }}>Ticket Promedio de Vida</th><th style={{ textAlign: 'right' }}>Valor Total Generado</th></tr></thead>
          <tbody>
            {data?.storeLoyalty?.map((row: any) => (
              <tr key={row.store_id}>
                <td style={{ fontWeight: 600 }}>Tienda {row.store_id}</td>
                <td style={{ textAlign: 'center' }}>{row.loyal_customers}</td>
                <td style={{ textAlign: 'right' }}>${Number(row.avg_customer_value).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(row.total_store_value).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
