'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Seller {
  vendedor: string; ubicacion: string; total_ordenes: number;
  venta_total: number; clientes_registrados: number; clientes_no_registrados: number;
  anomaly_ratio?: number;
}

import DateRangePicker from '@/components/DateRangePicker';

export default function SellersPage() {
  const router = useRouter();
  const { theme } = useTheme();
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function fetchData() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/sellers?inicio=${inicio}&fin=${fin}`);
      const json = await res.json();
      if (!res.ok) setError(json.detail || json.error || 'Error');
      setSellers(json.sellers || []);
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [inicio, fin]);

  const filtered = sellers.filter(s =>
    (s.vendedor || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.ubicacion || '').toLowerCase().includes(search.toLowerCase())
  );

  const top5 = [...filtered].sort((a, b) => Number(b.venta_total) - Number(a.venta_total)).slice(0, 5)
    .map(s => ({ name: (s.vendedor || 'N/A').split(' ').slice(-2).join(' '), venta: Math.round(Number(s.venta_total)) }));

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Vendedores</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rendimiento y conversión de clientes</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8 }}>{error}</div>}

      {top5.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top 5 Venta</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={top5}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#222' : '#f0f0f0'} />
              <XAxis dataKey="name" tick={{ fill: theme === 'dark' ? '#555' : '#bbb', fontSize: 11 }} />
              <YAxis tick={{ fill: theme === 'dark' ? '#555' : '#bbb', fontSize: 11 }} tickFormatter={v => `$${(Number(v)/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`$${Number(v || 0).toLocaleString('es-MX')}`, 'Venta']} />
              <Bar dataKey="venta" fill={theme === 'dark' ? '#fff' : '#111'} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Buscar vendedor o tienda..." value={search}
          onChange={e => setSearch(e.target.value)} className="crm-input" style={{ width: '100%', maxWidth: 350 }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 32, marginBottom: 6 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sellers.length === 0 ? 'No hay datos de vendedores en este periodo.' : 'Sin resultados.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>#</th><th>Vendedor</th><th>Tienda</th>
                  <th style={{ textAlign: 'right' }}>Órdenes</th>
                  <th style={{ textAlign: 'right' }}>Venta</th>
                  <th style={{ textAlign: 'right' }}>Reg.</th>
                  <th style={{ textAlign: 'center' }}>% Reg.</th>
                  <th style={{ textAlign: 'center' }}>Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const pct = Number(s.total_ordenes) ? Math.round((Number(s.clientes_registrados) / Number(s.total_ordenes)) * 100) : 0;
                  return (
                    <tr 
                      key={i} 
                      onClick={() => router.push(`/admin/sellers/${encodeURIComponent(s.vendedor || '')}?inicio=${inicio}&fin=${fin}`)}
                      className="hover-row"
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{s.vendedor}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/admin/audit/seller/${encodeURIComponent(s.vendedor || '')}`); }}
                            style={{ border: 'none', background: 'none', padding: 0, color: 'var(--red)', fontSize: 10, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Expediente Forense
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.ubicacion}</td>
                      <td style={{ textAlign: 'right' }}>{s.total_ordenes}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        ${Number(s.venta_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>{s.clientes_registrados}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${pct >= 80 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : 'badge-red'}`}>{pct}%</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.anomaly_ratio && s.anomaly_ratio > 40 ? (
                          <span className="badge badge-red" style={{ fontWeight: 700 }}>ALTO</span>
                        ) : s.anomaly_ratio && s.anomaly_ratio > 20 ? (
                          <span className="badge badge-yellow">MEDIO</span>
                        ) : (
                          <span className="badge badge-green" style={{ opacity: 0.5 }}>BAJO</span>
                        )}
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
