'use client';
import { useState, useEffect, use } from 'react';
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Sun, Moon, TrendingUp, AlertCircle, CheckCircle, Info, BarChart3, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import DateRangePicker from '@/components/DateRangePicker';

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

export default function TiendaDetalle({ params: paramsPromise }: { params: Promise<{ tienda: string }> }) {
  const { tienda } = use(paramsPromise);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [inicio, setInicio] = useState(searchParams.get('inicio') || getYesterday());
  const [fin, setFin] = useState(searchParams.get('fin') || getYesterday());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [registrados, setRegistrados] = useState<TicketRow[]>([]);
  const [validos, setValidos] = useState<TicketRow[]>([]);
  const [recompras, setRecompras] = useState<TicketRow[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData(ini: string, fi: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tienda/${tienda}?inicio=${ini}&fin=${fi}`);
      const json = await res.json();
      setResumen(json.resumen || null);
      setRegistrados(json.registrados || []);
      setValidos(json.tickets_validos || []);
      setRecompras(json.recompras || []);
      setOrdenes(json.ordenes || []);
      setInsights(json.insights || null);
      setTrends(json.trends || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(inicio, fin); }, [inicio, fin]);

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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Panel de Control · Tiendas</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
          <button className="theme-toggle" onClick={toggle}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
        </div>
      </header>

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* KPI Summary */}
            {resumen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card">
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">{Number(resumen.orders).toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Registros</div>
                  <div className="stat-value">{Number(resumen.registrados).toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Tickets Válidos</div>
                  <div className="stat-value">{Number(resumen.tickets_validos).toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Conversión Final</div>
                  <div className="stat-value" style={{ color: conv >= 90 ? '#22c55e' : conv >= 60 ? '#ca8a04' : '#ef4444' }}>
                    {conv.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Insights Section */}
            {insights && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                {/* Day Analysis */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <BarChart3 size={16} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Análisis de Desempeño por Periodo</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Promedio por día de la semana:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.weekdayAnalysis.map((w: any) => (
                          <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 80, fontSize: 11, fontWeight: 500 }}>{w.name}</div>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${w.avg}%`, 
                                height: '100%', 
                                background: w.avg >= 90 ? '#22c55e' : w.avg >= 60 ? '#ca8a04' : '#ef4444' 
                              }} />
                            </div>
                            <div style={{ width: 35, fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{w.avg.toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Diagnóstico de Riesgos:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {insights.incompleteRegistrations > 0 && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <AlertCircle size={14} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>Captura Incompleta</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{insights.incompleteRegistrations} registros sin correo válido detectados.</div>
                            </div>
                          </div>
                        )}
                        {insights.lowDays.length > 0 ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <TrendingUp size={14} color="#ca8a04" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>Días de Baja Conversión</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Presentaste {insights.lowDays.length} días con menos del 60%.</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <CheckCircle size={14} color="#22c55e" />
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>Consistencia Lograda</div>
                          </div>
                        )}
                        <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, marginBottom: 2 }}>
                            <Info size={10} /> Tip:
                          </div>
                          Tu mejor día es el <b>{insights.bestDay?.name}</b> con {insights.bestDay?.avg.toFixed(1)}%. ¡Mantén ese ritmo!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Sello de Calidad</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: conv >= 90 ? '#22c55e' : conv >= 60 ? '#ca8a04' : '#ef4444' }}>
                    {conv >= 90 ? 'EXCELENTE' : conv >= 60 ? 'REGULAR' : 'CRÍTICO'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Basado en {Number(resumen?.orders || 0).toLocaleString()} tickets totales en este rango.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Section title="Registros" count={registrados.length} rows={registrados} />
              <Section title="Tickets Válidos" count={validos.length} rows={validos} />
            </div>

            <Section title="Recompras" count={recompras.length} rows={recompras} defaultOpen={false} />
            
            {/* Órdenes */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Transacciones Recientes (Netsuite)</span>
                <span style={{ background: 'var(--bg-secondary)', padding: '1px 8px', borderRadius: 20, fontSize: 12, color: 'var(--text-muted)' }}>{ordenes.length}</span>
              </div>
              {ordenes.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin órdenes en este periodo</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="crm-table">
                    <thead><tr><th>ID</th><th>Folio</th><th>Correo</th><th>Cliente</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {ordenes.map((o: OrdenRow) => (
                        <tr key={o.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.id}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{o.folio}</td>
                          <td style={{ fontSize: 12 }}>{o.email || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.clientenetsuite}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(o.created_date).toLocaleDateString()}</td>
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
