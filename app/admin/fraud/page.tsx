'use client';
import { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertCircle, ShoppingBag, UserX, MapPin, 
  Search, Zap, Trash2, LayoutGrid, Phone, Mail, 
  Hash, ChevronRight, Eye, AlertTriangle 
} from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import DateRangePicker from '@/components/DateRangePicker';
import EvidencePanel from '@/components/EvidencePanel';
import { SecurityVault } from '@/components/SecurityVault';

export default function FraudDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);

  async function fetchAuditData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/fraud?inicio=${inicio}&fin=${fin}`);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAuditData(); }, [inicio, fin]);

  const openEvidence = (title: string, item: any) => {
    setEvidenceTitle(title);
    setEvidenceData(item);
    setIsEvidenceOpen(true);
  };

  return (
    <SecurityVault>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ShieldAlert size={28} color="var(--red)" />
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Auditoría de Patrones Críticos</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Detección algorítmica de comportamientos fraudulentos con datos reales de Azure SQL</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
          </div>
        </div>

        {/* Primary Risk Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { icon: <Mail size={20} color="var(--red)"/>, label: 'Correos Desechables', value: data?.disposableAlerts?.length || 0, desc: 'Riesgo Crítico / Ban Inmediato', color: 'var(--red)' },
            { icon: <Phone size={20} color="var(--orange)"/>, label: 'Reuso de Teléfono', value: data?.contactReuse?.length || 0, desc: 'Múltiples correos por móvil', color: 'var(--orange)' },
            { icon: <Zap size={20} color="#f59e0b"/>, label: 'Frecuencia Semanal', value: data?.velocityWeekly?.length || 0, desc: '>2 compras por semana', color: '#f59e0b' },
            { icon: <Hash size={20} color="var(--red)"/>, label: 'Patrones Secuenciales', value: data?.sequentialAlerts?.length || 0, desc: 'Prefixes user01, user02...', color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, borderTop: `4px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</div>
                {s.icon}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>{loading ? <span className="skeleton-line" style={{width: 40}}></span> : s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 24 }}>
          
          {/* 1. Velocity Weekly - THE "LUZ VERDE" REQUEST */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#f59e0b" /> Frecuencia de Compra Anómala (Semanal)
              </div>
              <ExportButton data={data?.velocityWeekly || []} filename="auditoria_frecuencia_semanal" />
            </div>
            <div style={{ padding: '12px 20px', fontSize: 13, borderBottom: '1px solid var(--border)', background: 'rgba(245, 158, 11, 0.05)', color: 'var(--text-muted)' }}>
              Clientes con más de 2 compras inusuales en el periodo. Altamente inusual para consumo regular.
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Correo / Cliente</th><th style={{ textAlign: 'center' }}>Compras</th><th>Vendedores</th><th style={{ textAlign: 'right' }}>Acción</th></tr>
                </thead>
                <tbody>
                  {data?.velocityWeekly?.length > 0 ? data.velocityWeekly.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{row.correo}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-yellow">{row.total_usos}x</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.lista_vendedores}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => openEvidence('Frecuencia Semanal', row)} className="btn-icon">
                          <Eye size={16} /> Ver Pruebas
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>{loading ? 'Analizando frecuencia...' : 'Sin alertas semanales.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Phone Reuse - TOUGH PROOF */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={18} color="var(--orange)" /> Reuso de Teléfono (Multi-Cuenta)
              </div>
              <ExportButton data={data?.contactReuse || []} filename="auditoria_reuso_telefono" />
            </div>
            <div style={{ padding: '12px 20px', fontSize: 13, borderBottom: '1px solid var(--border)', background: 'rgba(249, 115, 22, 0.05)', color: 'var(--text-muted)' }}>
              Un solo número telefónico vinculado a múltiples correos distintos. Evidencia clara de creación de perfiles falsos.
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Teléfono</th><th style={{ textAlign: 'center' }}>Correos</th><th style={{ textAlign: 'center' }}>Tickets</th><th style={{ textAlign: 'right' }}>Acción</th></tr>
                </thead>
                <tbody>
                  {data?.contactReuse?.length > 0 ? data.contactReuse.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13, fontWeight: 700 }}>{row.phone}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-red">{row.emails_qty} cuentas</span></td>
                      <td style={{ textAlign: 'center', fontSize: 13 }}>{row.tickets_qty}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => openEvidence('Reuso de Teléfono', row)} className="btn-icon">
                          <Eye size={16} /> Ver Pruebas
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>{loading ? 'Cruzando teléfonos...' : 'Teléfonos limpios.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, marginBottom: 24 }}>
          
          {/* 3. Disposable Emails */}
          <div className="card" style={{ padding: 0, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)' }}>
                <Mail size={18} /> Correos Desechables Detectados
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Correo Basura</th><th>Vendedor</th><th>Tienda</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
                </thead>
                <tbody>
                  {data?.disposableAlerts?.length > 0 ? data.disposableAlerts.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{row.correo}</td>
                      <td style={{ fontSize: 11 }}>{row.vendedor.replace(/^\d+\s/, '')}</td>
                      <td style={{ fontSize: 11 }}>{row.tienda}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${row.monto}</td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>{loading ? 'Escaneando dominios...' : 'Sin correos basura detectados.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Sequential Patterns */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Hash size={18} /> Patrones Secuenciales (user01, 02...)
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Prefijo Detectado</th><th style={{ textAlign: 'center' }}>Cantidad</th><th>Historial de Variantes</th><th style={{ textAlign: 'right' }}>Acción</th></tr>
                </thead>
                <tbody>
                  {data?.sequentialAlerts?.length > 0 ? data.sequentialAlerts.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13, fontWeight: 700 }}>{row.prefix}***</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-red">{row.qty}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.email_list}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => openEvidence('Patrones Secuenciales', row)} className="btn-icon">
                          <Eye size={16} /> Ver Pruebas
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>{loading ? 'Buscando secuencias...' : 'Sin patrones secuenciales.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
          
          {/* 5. Ranking Anomalia */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid size={18} /> Ranking de Falsificación por Cajero
              </div>
              <ExportButton data={data?.sellerScores || []} filename="auditoria_ranking_sellers" />
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Vendedor</th><th style={{ textAlign: 'center' }}>Tickets</th><th style={{ textAlign: 'center' }}>Falsos</th><th style={{ textAlign: 'right' }}>% Riesgo</th></tr>
                </thead>
                <tbody>
                  {data?.sellerScores?.length > 0 ? data.sellerScores.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{row.vendedor.replace(/^\d+\s/, '')}</td>
                      <td style={{ textAlign: 'center' }}>{row.total_registros}</td>
                      <td style={{ textAlign: 'center', color: 'var(--red)' }}>{row.correos_repetidos}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${Number(row.anomaly_ratio) > 40 ? 'badge-red' : 'badge-yellow'}`}>
                          {row.anomaly_ratio}%
                        </span>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Sin data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Domain Spoofing */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} /> Domain Spoofing (Reciclaje de Prefijo)
              </div>
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Prefijo</th><th style={{ textAlign: 'center' }}>Dominios</th><th style={{ textAlign: 'center' }}>Tickets</th><th style={{ textAlign: 'right' }}>Acción</th></tr>
                </thead>
                <tbody>
                  {data?.massSpoofing?.length > 0 ? data.massSpoofing.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13, fontWeight: 700 }}>{row.prefijo}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-red">{row.dominios_qty}</span></td>
                      <td style={{ textAlign: 'center' }}>{row.folios_afectados}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => openEvidence('Domain Spoofing', row)} className="btn-icon">
                          <Eye size={16} /> Ver Pruebas
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Limpio.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <EvidencePanel 
          isOpen={isEvidenceOpen} 
          onClose={() => setIsEvidenceOpen(false)} 
          title={evidenceTitle} 
          data={evidenceData} 
        />
        
        <style jsx>{`
          .btn-icon {
            background: rgba(0,0,0,0.03);
            border: 1px solid var(--border);
            padding: 6px 10px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-icon:hover {
            background: var(--bg-hover);
            border-color: var(--text-muted);
          }
        `}</style>
      </div>
    </SecurityVault>
  );
}
