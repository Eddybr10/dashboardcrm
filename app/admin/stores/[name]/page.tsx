'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Store, Users, AlertTriangle, History, TrendingUp, DollarSign, Ticket } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import DateRangePicker from '@/components/DateRangePicker';

export default function StoreDetailPage({ params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = use(paramsPromise);
  const storeName = decodeURIComponent(params.name);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);

  async function fetchStoreData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeName)}?inicio=${inicio}&fin=${fin}`);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchStoreData(); }, [inicio, fin]);

  if (loading && !data) return <div className="p-8">Cargando...</div>;

  const m = data?.store?.metrics || {};

  return (
    <div style={{ padding: '24px 28px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <ArrowLeft size={16} /> Volver al Dashboard
      </button>

      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Store size={22} />
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>{storeName}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Análisis detallado de punto de venta</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Venta Total', value: `$${Number(m.venta_total || 0).toLocaleString()}`, icon: <DollarSign size={14}/> },
          { label: 'Tickets', value: m.tickets?.toLocaleString(), icon: <Ticket size={14}/> },
          { label: 'Conversión', value: `${Number(m.conversion || 0).toFixed(1)}%`, icon: <TrendingUp size={14}/> },
          { label: 'Registros', value: m.registrados?.toLocaleString(), icon: <Users size={14}/> },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{s.icon} {s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        {/* Vendedores */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} /> Staff de Tienda
            </div>
            <ExportButton data={data?.sellers || []} filename={`vendedores_${storeName}`} />
          </div>
          <table className="crm-table">
            <thead><tr><th>#</th><th>Vendedor</th><th style={{ textAlign: 'right' }}>Tickets</th><th style={{ textAlign: 'right' }}>Venta</th></tr></thead>
            <tbody>
              {data?.sellers?.map((s: any, i: number) => (
                <tr key={s.vendedor}>
                  <td>{i+1}</td>
                  <td style={{ fontWeight: 500 }}>{s.vendedor}</td>
                  <td style={{ textAlign: 'right' }}>{s.tickets}</td>
                  <td style={{ textAlign: 'right' }}>${Number(s.venta).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fraude / Repetición */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)' }}>
              <AlertTriangle size={16} /> Alertas de Repetición
            </div>
            <ExportButton data={data?.fraud || []} filename={`alertas_${storeName}`} />
          </div>
          <div style={{ padding: '12px 16px', fontSize: 12, borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
            Correos utilizados más de una vez en esta tienda
          </div>
          <table className="crm-table">
            <thead><tr><th>Correo</th><th style={{ textAlign: 'center' }}>Qty</th><th>Vendedores</th></tr></thead>
            <tbody>
              {data?.fraud?.length > 0 ? data.fraud.map((f: any) => (
                <tr key={f.correo}>
                  <td style={{ fontSize: 12 }}>{f.correo}</td>
                  <td style={{ textAlign: 'center' }}><span className="badge badge-red">{f.qty}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.vendedores}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No se detectaron repeticiones sospechosas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de Tickets */}
      <div className="card" style={{ padding: 0, marginTop: 24 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} /> Últimas Transacciones
          </div>
          <ExportButton data={data?.recentTickets || []} filename={`tickets_${storeName}`} />
        </div>
        <table className="crm-table">
          <thead><tr><th>Folio</th><th>Fecha</th><th>Vendedor</th><th>Cliente (Email)</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
          <tbody>
            {data?.recentTickets?.map((t: any) => (
              <tr key={t.folio}>
                <td style={{ fontWeight: 600 }}>{t.folio}</td>
                <td style={{ fontSize: 12 }}>{new Date(t.fecha_venta).toLocaleDateString()}</td>
                <td style={{ color: 'var(--text-muted)' }}>{t.vendedor}</td>
                <td>{t.email || <span style={{ opacity: 0.3 }}>N/A</span>}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>${Number(t.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
