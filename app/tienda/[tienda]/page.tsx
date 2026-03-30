'use client';
import { useState, useEffect, use } from 'react';
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';

interface TicketRow {
  id: number; categoria: string; folio: string; email: string; estado: string;
  fecha: string; fechaBase: string; tienda: string; verificado: number;
}
interface OrdenRow { id: number; folio: string; email: string; clientenetsuite: string; created_date: string; }
interface Resumen {
  orders: number; registrados: number; tickets_validos: number; recompras: number;
  conversion: string; tasa_recompras: string;
}

function estadoClass(e: string) {
  if (e.includes('Nuevo')) return 'estado-nuevo';
  if (e.includes('Previo')) return 'estado-previo';
  if (e.includes('Sin Tag')) return 'estado-sin-tag';
  if (e.includes('Sin correo')) return 'estado-sin-correo';
  if (e.includes('Actualizado')) return 'estado-actualizado';
  return '';
}

function Section({ title, count, rows, defaultOpen = true }: {
  title: string; count: number; rows: TicketRow[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ padding: 0 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', cursor: 'pointer',
        borderBottom: open ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <span style={{ background: 'var(--bg-secondary)', padding: '1px 8px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{count}</span>
        </div>
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </div>
      {open && (rows.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin registros</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="crm-table">
            <thead><tr><th>ID</th><th>Folio</th><th>Correo</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.id}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{r.folio}</td>
                  <td style={{ fontSize: 12 }}>{r.email || '—'}</td>
                  <td><span className={`estado-badge ${estadoClass(r.estado)}`}>{r.estado}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.fechaBase || r.fecha || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function getYesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }

export default function TiendaDetalle({ params }: { params: Promise<{ tienda: string }> }) {
  const { tienda } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [fecha, setFecha] = useState(searchParams.get('fecha') || getYesterday());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [registrados, setRegistrados] = useState<TicketRow[]>([]);
  const [validos, setValidos] = useState<TicketRow[]>([]);
  const [recompras, setRecompras] = useState<TicketRow[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData(f: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tienda/${tienda}?fecha=${f}`);
      const json = await res.json();
      setResumen(json.resumen || null);
      setRegistrados(json.registrados || []);
      setValidos(json.tickets_validos || []);
      setRecompras(json.recompras || []);
      setOrdenes(json.ordenes || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(fecha); }, []);

  const nombre = decodeURIComponent(tienda);
  const conv = resumen ? parseFloat(resumen.conversion) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '12px 28px',
        display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)',
      }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: '6px 10px' }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{nombre}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color="var(--text-muted)" />
          <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); fetchData(e.target.value); }} className="crm-input" />
          <button className="theme-toggle" onClick={toggle}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
        </div>
      </header>

      <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {resumen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card"><div className="stat-label">Tickets</div><div className="stat-value">{resumen.orders}</div></div>
                <div className="stat-card"><div className="stat-label">Registros</div><div className="stat-value">{resumen.registrados}</div></div>
                <div className="stat-card"><div className="stat-label">Válidos</div><div className="stat-value">{resumen.tickets_validos}</div></div>
                <div className="stat-card">
                  <div className="stat-label">Conversión</div>
                  <div className="stat-value" style={{ color: conv >= 90 ? '#22c55e' : conv >= 60 ? '#ca8a04' : '#ef4444' }}>{conv.toFixed(0)}%</div>
                </div>
              </div>
            )}
            <Section title="Registros" count={registrados.length} rows={registrados} />
            <Section title="Tickets Válidos" count={validos.length} rows={validos} />
            <Section title="Recompras" count={recompras.length} rows={recompras} defaultOpen={false} />
            
            {/* Órdenes */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Órdenes</span>
                <span style={{ background: 'var(--bg-secondary)', padding: '1px 8px', borderRadius: 20, fontSize: 12, color: 'var(--text-muted)' }}>{ordenes.length}</span>
              </div>
              {ordenes.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin órdenes</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="crm-table">
                    <thead><tr><th>ID</th><th>Folio</th><th>Correo</th><th>Cliente</th></tr></thead>
                    <tbody>
                      {ordenes.map((o: OrdenRow) => (
                        <tr key={o.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.id}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{o.folio}</td>
                          <td style={{ fontSize: 12 }}>{o.email || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.clientenetsuite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
