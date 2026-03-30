'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import ExportButton from '@/components/ExportButton';
import { ExternalLink } from 'lucide-react';

import DateRangePicker from '@/components/DateRangePicker';

export default function AdminPage() {
  const { theme } = useTheme();
  const router = useRouter();
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [porDia, setPorDia] = useState<Record<string, unknown>[]>([]);
  const [porTienda, setPorTienda] = useState<Record<string, unknown>[]>([]);

  async function fetchData() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ inicio, fin });
      if (tipo) p.append('tipo', tipo);
      const res = await fetch(`/api/admin/dashboard?${p}`);
      const json = await res.json();
      setPorDia(json.porDia || []);
      setPorTienda(json.porTienda || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [inicio, fin, tipo]);

  const totals = (porDia as any[]).reduce(
    (a, r) => ({ 
      t: a.t + Number(r.tickets || 0), 
      reg: a.reg + Number(r.registrados || 0), 
      rec: a.rec + Number(r.recompras || 0) 
    }),
    { t: 0, reg: 0, rec: 0 }
  );
  const conv = totals.t ? Math.round((totals.reg / totals.t) * 100) : 0;
  const axisColor = theme === 'dark' ? '#555' : '#bbb';

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Visión global de conversión</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="crm-input" style={{ width: 110, fontSize: 12 }}>
          <option value="">Todo</option>
          <option value="BTQ">Boutique</option>
          <option value="FS">Factory</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tickets', value: totals.t.toLocaleString() },
          { label: 'Registros', value: totals.reg.toLocaleString() },
          { label: 'Conversión', value: `${conv}%` },
          { label: 'Recompras', value: totals.rec.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Tendencia</div>
        {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#222' : '#f0f0f0'} />
              <XAxis dataKey="dia" tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={v => String(v).slice(5)} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }} />
              <Line type="monotone" dataKey="tickets" stroke="#111" dot={false} strokeWidth={2} name="Tickets" />
              <Line type="monotone" dataKey="registrados" stroke="#888" dot={false} strokeWidth={1.5} name="Registros" />
              <Line type="monotone" dataKey="recompras" stroke="#ccc" dot={false} strokeWidth={1.5} name="Recompras" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>Top Tiendas <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {inicio} a {fin}</span></div>
          <ExportButton data={porTienda} filename="reporte_tiendas" />
        </div>
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 32, marginBottom: 6 }} />)}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="crm-table">
              <thead><tr><th>#</th><th>Tienda</th><th style={{ textAlign: 'right' }}>Tickets</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'center' }}>Conv</th></tr></thead>
              <tbody>
                {porTienda.slice(0, 15).map((row, i) => {
                  const c = Number(row.conversion_avg) || 0;
                  return (
                    <tr key={String(row.tienda)}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                        <div 
                          onClick={() => router.push(`/admin/stores/${encodeURIComponent(String(row.tienda))}`)}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                          onMouseOver={(e) => (e.currentTarget.style.color = '#334155')}
                          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text)')}
                        >
                          {String(row.tienda)}
                          <ExternalLink size={12} style={{ opacity: 0.3 }} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{String(row.tickets)}</td>
                      <td style={{ textAlign: 'right' }}>{String(row.registrados)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${c >= 90 ? 'badge-green' : c >= 60 ? 'badge-yellow' : 'badge-red'}`}>{c.toFixed(0)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
