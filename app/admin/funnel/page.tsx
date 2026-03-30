'use client';
import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, LabelList 
} from 'recharts';
import { 
  LayoutDashboard, GitBranch, Download, Filter, 
  Calendar, Store, ChevronRight, Info, AlertCircle 
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import DateRangePicker from '@/components/DateRangePicker';

export default function FunnelPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [locationId, setLocationId] = useState('all');

  useEffect(() => {
    fetch('/api/admin/locations')
      .then(res => res.json())
      .then(setLocations)
      .catch(console.error);
  }, []);

  async function fetchFunnel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?inicio=${inicio}&fin=${fin}&locationId=${locationId}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFunnel();
  }, [inicio, fin, locationId]);

  const handleExport = () => {
    window.open(`/api/admin/funnel/export?inicio=${inicio}&fin=${fin}&locationId=${locationId}`, '_blank');
  };

  const funnelData = data ? [
    { name: 'Tickets Totales', value: data.summary.totalTickets, fill: '#111111' },
    { name: 'Tickets Válidos', value: data.summary.ticketsValidos, fill: '#333333' },
    { name: 'Recompras', value: data.summary.recompras, fill: '#666666' },
    { name: 'Registrados', value: data.summary.registrados, fill: '#999999' },
  ] : [];

  const getPercentage = (val: number, total: number) => {
    if (!total) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ background: 'var(--text)', color: 'var(--bg)', padding: 6, borderRadius: 8 }}>
              <GitBranch size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Embudo de Conversión</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Análisis de retención y registro de clientes en tienda</p>
        </div>
        <button onClick={handleExport} className="btn" style={{ gap: 8 }}>
          <Download size={16} /> Exportar Detalle CSV
        </button>
      </header>

      <section style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Store size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
          <select 
            value={locationId} 
            onChange={e => setLocationId(e.target.value)} 
            className="crm-input" 
            style={{ paddingLeft: 34, minWidth: 200 }}
          >
            <option value="all">Todas las Tiendas</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Tickets', value: data?.summary.totalTickets, sub: 'Órdenes en Azure' },
          { label: 'Tickets Válidos', value: data?.summary.ticketsValidos, sub: `${getPercentage(data?.summary.ticketsValidos, data?.summary.totalTickets)} del total` },
          { label: 'Recompras', value: data?.summary.recompras, sub: `${getPercentage(data?.summary.recompras, data?.summary.ticketsValidos)} de válidos` },
          { label: 'Registrados', value: data?.summary.registrados, sub: `${getPercentage(data?.summary.registrados, data?.summary.ticketsValidos)} de válidos` },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '...' : (s.value || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.sub}</div>
            <div style={{ 
              position: 'absolute', right: -10, bottom: -10, opacity: 0.03, transform: 'rotate(-15deg)'
            }}>
              <GitBranch size={80} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Visualización del Embudo</h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Valores Absolutos</span>
            </div>
          </div>
          
          <div style={{ height: 350, width: '100%' }}>
            {loading ? (
              <div className="skeleton" style={{ height: '100%', width: '100%' }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={funnelData}
                  margin={{ top: 5, right: 80, left: 100, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'var(--text)', fontSize: 13, fontWeight: 500 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      formatter={(v: any) => v?.toLocaleString?.() || v}
                      style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Análisis de Conversión</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Captura de Email', val: data?.summary.ticketsValidos, from: data?.summary.totalTickets, color: '#111' },
              { label: 'Retención (Recompra)', val: data?.summary.recompras, from: data?.summary.ticketsValidos, color: '#444' },
              { label: 'Lealtad (Miembros)', val: data?.summary.registrados, from: data?.summary.ticketsValidos, color: '#777' },
            ].map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{p.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{getPercentage(p.val, p.from)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: getPercentage(p.val, p.from), 
                    background: p.color,
                    transition: 'width 1s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: 'auto', 
            padding: 16, 
            background: 'var(--bg-secondary)', 
            borderRadius: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            gap: 12
          }}>
            <Info size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Este embudo muestra la "fuga" de datos en el punto de venta. 
              <strong>Tickets Válidos</strong> son aquellos con correo capturado correctamente. 
              Un porcentaje bajo en <strong>Lealtad</strong> indica que muchos clientes compran pero no se registran en el programa.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow);
          transition: transform 0.2s;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
      `}</style>
    </div>
  );
}
