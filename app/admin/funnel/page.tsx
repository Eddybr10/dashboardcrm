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
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [data, setData] = useState<any>(null);
  const [detailedOrders, setDetailedOrders] = useState<any[]>([]);
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

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  async function fetchFunnel() {
    setLoading(true);
    setProgress(10);
    setSeconds(0);
    
    const progInterval = setInterval(() => {
      setProgress(p => (p < 90 ? p + Math.random() * 5 : p));
    }, 400);

    const timerInterval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    try {
      const res = await fetch(`/api/admin/funnel?inicio=${inicio}&fin=${fin}&locationId=${locationId}`);
      const json = await res.json();
      setData(json);
      setDetailedOrders(json.detailedOrders || []);
      setProgress(100);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(progInterval);
      clearInterval(timerInterval);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 500);
    }
  }

  useEffect(() => {
    fetchFunnel();
  }, [inicio, fin, locationId]);

  const handleExport = () => {
    if (!detailedOrders.length) return;
    
    // Generate CSV locally
    const headers = ['Folio', 'Fecha', 'Tienda', 'Monto', 'Email Original', 'Email Encontrado', 'Cliente', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...detailedOrders.map(o => [
        o.folio,
        o.fecha,
        `"${o.tienda}"`,
        o.monto,
        o.emailOriginal,
        o.emailEncontrado,
        `"${o.cliente}"`,
        o.estado
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Embudo_Detalle_${inicio}_${fin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      {/* Progress Bar Container */}
      {loading && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, height: 4, zIndex: 9999,
          background: 'rgba(255,255,255,0.1)', overflow: 'hidden' 
        }}>
          <div style={{ 
            height: '100%', width: `${progress}%`, background: 'var(--text)', 
            transition: 'width 0.4s ease-out', boxShadow: '0 0 10px var(--text)' 
          }} />
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={handleExport} 
            disabled={loading || !detailedOrders.length}
            className="btn" 
            style={{ 
              gap: 8, 
              opacity: (loading || !detailedOrders.length) ? 0.5 : 1,
              cursor: (loading || !detailedOrders.length) ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={16} /> 
            {loading ? 'Procesando...' : 'Exportar Detalle CSV'}
          </button>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Store size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
          <select 
            value={locationId} 
            onChange={e => setLocationId(e.target.value)} 
            disabled={loading}
            className="crm-input" 
            style={{ paddingLeft: 34, minWidth: 200, opacity: loading ? 0.6 : 1 }}
          >
            <option value="all">Todas las Tiendas</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
            <div className="spinner-small" />
            <span>Consultando Guper...</span>
            <span style={{ 
              background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 6, 
              fontFamily: 'monospace', fontWeight: 600, border: '1px solid var(--border)' 
            }}>
              {formatTime(seconds)}
            </span>
          </div>
        )}
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
              position: 'absolute', right: -10, bottom: -10, opacity: 0.1, transform: 'rotate(-15deg)'
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
          
          <div style={{ height: 350, width: '100%', position: 'relative' }}>
            {loading ? (
              <div style={{ 
                height: '100%', width: '100%', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-secondary)',
                borderRadius: 12
              }}>
                <div className="spinner" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Cargando información...</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Tiempo transcurrido: {formatTime(seconds)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>
                    Analizando {detailedOrders.length || 'foliando'} datos de Guper
                  </span>
                </div>
              </div>
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
        .spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0,0,0,0.1);
          border-top-color: var(--text);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0,0,0,0.1);
          border-top-color: var(--text);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
