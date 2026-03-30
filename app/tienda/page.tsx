'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, Calendar, RefreshCcw, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';

interface TiendaRow {
  tienda: string; orders: number; registrados: number; tickets_validos: number;
  recompras: number; conversion: string; tasa_recompras: string;
}

function getYesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function convClass(n: number) {
  if (n >= 90) return 'badge-green';
  if (n >= 60) return 'badge-yellow';
  return 'badge-red';
}

export default function TiendaPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [fecha, setFecha] = useState(getYesterday());
  const [data, setData] = useState<TiendaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  async function fetchData(f: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tienda?fecha=${f}`);
      const json = await res.json();
      setData(json.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(fecha); }, [fecha]);

  const filtered = useMemo(() =>
    data.filter(r => r.tienda.toLowerCase().includes(search.toLowerCase())),
  [data, search]);

  const totals = useMemo(() => ({
    tickets: filtered.reduce((a, r) => a + Number(r.orders), 0),
    registros: filtered.reduce((a, r) => a + Number(r.registrados), 0),
    validos: filtered.reduce((a, r) => a + Number(r.tickets_validos), 0),
    recompras: filtered.reduce((a, r) => a + Number(r.recompras), 0),
  }), [filtered]);

  function exportCSV() {
    const h = 'Ubicación,Tickets,Registros,Tickets Válidos,Recompras,Conversión,Tasa Recompra';
    const rows = filtered.map(r =>
      `"${r.tienda}",${r.orders},${r.registrados},${r.tickets_validos},${r.recompras},${r.conversion}%,${r.tasa_recompras}%`
    );
    const blob = new Blob([h + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `cloe-tiendas-${fecha}.csv`; a.click();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '12px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.5px' }}>CLOE</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Portal Tiendas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="theme-toggle" onClick={toggle} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <a href="/admin" className="btn-ghost" style={{ fontSize: 12 }}>Admin →</a>
        </div>
      </header>

      <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="crm-input" />
          </div>
          <div style={{ flex: 1, maxWidth: 300, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar tienda..." value={search}
              onChange={e => setSearch(e.target.value)} className="crm-input" style={{ width: '100%', paddingLeft: 32 }} />
          </div>
          <button onClick={exportCSV} className="btn-ghost"><Download size={13} /> CSV</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Tickets', value: totals.tickets },
            { label: 'Registros', value: totals.registros },
            { label: 'Válidos', value: totals.validos },
            { label: 'Recompras', value: totals.recompras },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><div className="spinner" /></div>
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay datos para esta fecha.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th style={{ textAlign: 'right' }}>Tickets</th>
                    <th style={{ textAlign: 'right' }}>Registros</th>
                    <th style={{ textAlign: 'right' }}>Válidos</th>
                    <th style={{ textAlign: 'right' }}>Recompras</th>
                    <th style={{ textAlign: 'center' }}>Conversión</th>
                    <th style={{ textAlign: 'center' }}>Recompra</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.tienda} onClick={() => router.push(`/tienda/${encodeURIComponent(row.tienda)}?fecha=${fecha}`)}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{row.tienda}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{row.orders}</td>
                      <td style={{ textAlign: 'right' }}>{row.registrados}</td>
                      <td style={{ textAlign: 'right' }}>{row.tickets_validos}</td>
                      <td style={{ textAlign: 'right' }}>{row.recompras}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${convClass(parseFloat(row.conversion))}`}>
                          {parseFloat(row.conversion).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {parseFloat(row.tasa_recompras).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 11 }}>
          {filtered.length} tiendas · {fecha}
        </div>
      </div>
    </div>
  );
}
