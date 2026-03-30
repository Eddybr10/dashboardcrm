'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserX, AlertCircle, Trash2, History, ShieldAlert, CheckCircle } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import DateRangePicker from '@/components/DateRangePicker';
import { SecurityVault } from '@/components/SecurityVault';

export default function SellerAuditPage({ params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = use(paramsPromise);
  const sellerName = decodeURIComponent(params.name);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  const [inicio, setInicio] = useState('2025-01-01');
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleExpand = (folio: string) => {
    if (expandedRow === folio) setExpandedRow(null);
    else setExpandedRow(folio);
  };

  async function fetchAuditDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit/seller/${encodeURIComponent(sellerName)}?inicio=${inicio}&fin=${fin}`);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAuditDetail(); }, [inicio, fin]);

  if (loading && !data) return <div className="p-8">Cargando expediente forense...</div>;

  const s = data?.summary || {};
  const isHighRisk = (s.total_registros > 0 && (1 - (s.prefijos_unicos / s.total_registros)) > 0.4) || s.spoofing_cases > 0;

  return (
    <SecurityVault>
      <div style={{ padding: '24px 28px' }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <ArrowLeft size={16} /> Volver a Vendedores
        </button>

        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <UserX size={22} color={isHighRisk ? 'var(--red)' : 'var(--text-muted)'} />
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>Auditoría POS: {sellerName}</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Análisis de tickets facturados y fraudes de captura</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
          </div>
        </div>

        {/* Risk Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
          <div className="stat-card" style={{ borderLeft: `4px solid ${isHighRisk ? 'var(--red)' : 'var(--green)'}` }}>
            <div className="stat-label">Riesgo en Caja (POS)</div>
            <div className="stat-value" style={{ color: isHighRisk ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>
              {isHighRisk ? 'FRAUDE DETECTADO' : 'ACEPTABLE'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ratio de Anomalía (Substrings)</div>
            <div className="stat-value">{s.total_registros > 0 ? ((1 - (s.prefijos_unicos / s.total_registros)) * 100).toFixed(1) : 0}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Tickets Facturados</div>
            <div className="stat-value">{s.total_registros}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: s.spoofing_cases > 0 ? '4px solid var(--red)' : 'none' }}>
            <div className="stat-label">Domain Spoofing (Grave)</div>
            <div className="stat-value" style={{ color: s.spoofing_cases > 0 ? 'var(--red)' : 'var(--text)' }}>{s.spoofing_cases} Casos</div>
          </div>
          <div className="stat-card" style={{ borderLeft: s.cupones_sospechosos > 0 ? '4px solid #f97316' : 'none' }}>
            <div className="stat-label">Tickets con Descuento/Cupón</div>
            <div className="stat-value" style={{ color: s.cupones_sospechosos > 0 ? '#f97316' : 'var(--text)' }}>{s.cupones_sospechosos} Folios</div>
          </div>
        </div>
        
        {/* Forensic Conclusion */}
        <div className="card" style={{ padding: 24, border: `1px solid ${isHighRisk ? 'var(--red)' : 'var(--border)'}`, background: isHighRisk ? 'rgba(239,68,68,0.02)' : 'transparent', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            {isHighRisk ? <ShieldAlert size={20} color="var(--red)" /> : <CheckCircle size={20} color="var(--green)" />}
            Conclusión Auditada Forense
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
            {isHighRisk 
              ? `El vendedor ${sellerName} presenta anomalías CRÍTICAS en la facturación. Se detectó una repetición severa de prefijos en el ${s.total_registros > 0 ? ((1 - (s.prefijos_unicos / s.total_registros)) * 100).toFixed(1) : 0}% de sus tickets. La captura recurrente de correos comodín indica un patrón de falsificación de KPIs y/o posible robo financiero.`
              : `El vendedor ${sellerName} captura correos de forma aceptable en caja. No hay evidencia concluyente de relleno (stuffing) corporativo en este periodo.`
            }
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>

          {/* Spoofing Anomalies */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)' }}>
                <Trash2 size={16} /> Domain Spoofing (Múltiples Extensiones)
              </div>
              <ExportButton data={data?.spoofingAlerts || []} filename={`spoofing_seller_${sellerName}`} />
            </div>
            <div style={{ padding: '12px 16px', fontSize: 12, borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.05)' }}>
              Prefijos comunes usados con múltiples dominios distintos.
            </div>
            <table className="crm-table">
              <thead><tr><th>Prefijo Raíz</th><th style={{ textAlign: 'center' }}>Eventos</th><th>Dominios Empleados</th></tr></thead>
              <tbody>
                {data?.spoofingAlerts?.length > 0 ? data.spoofingAlerts.map((f: any) => (
                  <tr key={f.prefijo}>
                    <td style={{ fontWeight: 700 }}>{f.prefijo}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-red">{f.count}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.variantes}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Sin evidencia de Domain Spoofing.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Email Clusters */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} /> Reutilización de Correos (Stuffing)
              </div>
              <ExportButton data={data?.emailClusters || []} filename={`cluster_emails_${sellerName}`} />
            </div>
            <div style={{ padding: '12px 16px', fontSize: 12, borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
              Mismo correo capturado repetidamente por este vendedor.
            </div>
            <table className="crm-table">
              <thead><tr><th>Correo Electrónico (POS)</th><th style={{ textAlign: 'center' }}>Uso</th><th>Folios Facturados</th></tr></thead>
              <tbody>
                {data?.emailClusters?.length > 0 ? data.emailClusters.map((c: any) => (
                  <tr key={c.correo}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{c.correo}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-yellow">{c.qty}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150, whiteSpace: 'nowrap' }}>{c.folios}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Manejo de folios limpio.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial de Transacciones (Tickets/Folios) */}
        <div className="card" style={{ padding: 0, marginBottom: 32 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} /> Historial de Transacciones (Caja)
            </div>
            <ExportButton data={data?.historial || []} filename={`historial_${sellerName}`} />
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="crm-table">
              <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 10 }}>
                <tr>
                  <th>Folio</th>
                  <th>Fecha/Hora (POS)</th>
                  <th>Total Facturado</th>
                  <th>Correo Capturado</th>
                  <th style={{ textAlign: 'center' }}>Situación CMR / Fraude</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.historial?.length > 0 ? data.historial.map((h: any, i: number) => (
                  <tr key={i} style={{ borderBottom: expandedRow === h.folio ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{h.folio}</td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{h.fecha}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.hora}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      ${Number(h.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: 12, color: h.email === '-' ? 'var(--text-muted)' : 'var(--text)' }}>
                      {h.email}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        {h.guper ? (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>✅ Identificado</span>
                        ) : (
                          <span className="badge badge-yellow" style={{ fontSize: 11 }}>❌ No Validado</span>
                        )}
                        {h.alarma_autoregistro && <span className="badge badge-red" style={{ fontSize: 10 }}>🚨 AUTO-REGISTRO</span>}
                        {h.alarma_robo && <span className="badge badge-red" style={{ fontSize: 10, background: '#7f1d1d' }}>🚨 POSIBLE ROBO</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => toggleExpand(h.folio)} 
                        className="btn-ghost" 
                        style={{ fontSize: 11, padding: '4px 8px', height: 'auto', background: expandedRow === h.folio ? '#f3f4f6' : 'transparent' }}
                      >
                        {expandedRow === h.folio ? 'Ocultar Detalle' : 'Ver Detalles'}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>No hay facturas en el periodo.</td></tr>
                )}
              </tbody>
            </table>
            
            {/* Espacio para renderizar el Expandable Row condicionalmente (truco HTML para que quede bonito sin romper la tabla) */}
            {data?.historial?.map((h: any) => (
               expandedRow === h.folio && (
                 <div key={`expand-${h.folio}`} style={{ borderBottom: '1px solid var(--border)', background: '#fafafa', padding: '16px 24px' }}>
                   <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--blue)' }}>Detalles del Folio: {h.folio}</div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                     <div>
                       <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>MÉTODOS DE PAGO:</span>
                       <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>💳 {h.pagos}</div>
                     </div>
                     <div>
                       <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>PRODUCTOS FACTURADOS (SKUS):</span>
                       <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, lineHeight: 1.4 }}>🛒 {h.skus}</div>
                     </div>
                     <div>
                       <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CUPÓN UTILIZADO:</span>
                       <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: h.cupon ? 'var(--red)' : 'var(--text-muted)' }}>
                         {h.cupon ? `🎟️ ${h.cupon} (-$${h.descuento})` : 'Sin Cupón Activo'}
                       </div>
                     </div>
                   </div>
                 </div>
               )
            ))}
          </div>
        </div>
      </div>
    </SecurityVault>
  );
}
