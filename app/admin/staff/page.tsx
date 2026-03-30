'use client';
import { useState, useEffect } from 'react';
import { BadgeCheck, UserCheck, TrendingUp, Trophy, MapPin, Search } from 'lucide-react';
import ExportButton from '@/components/ExportButton';

import DateRangePicker from '@/components/DateRangePicker';
import { SecurityVault } from '@/components/SecurityVault';

export default function StaffDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [fin, setFin] = useState(() => new Date().toISOString().split('T')[0]);

  async function fetchStaffData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/staff?inicio=${inicio}&fin=${fin}`);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchStaffData(); }, [inicio, fin]);

  return (
    <SecurityVault>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <BadgeCheck size={22} />
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>Rendimiento de Staff</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Productividad individual de empleados por registro y verificación</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DateRangePicker inicio={inicio} fin={fin} onChange={(i, f) => { setInicio(i); setFin(f); }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <div className="stat-card">
            <div className="stat-label">Total Registros (Staff)</div>
            <div className="stat-value">{data?.staffPerformance?.reduce((a: any, b: any) => a + (b.total_registros || 0), 0) || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Verificaciones</div>
            <div className="stat-value">{data?.verificationPerformance?.reduce((a: any, b: any) => a + (b.verificaciones || 0), 0) || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mejor Registro</div>
            <div className="stat-value" style={{ fontSize: 13, fontWeight: 600 }}>{data?.staffPerformance?.[0]?.nombre_staff || '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mejor Verificador</div>
            <div className="stat-value" style={{ fontSize: 13, fontWeight: 600 }}>{data?.verificationPerformance?.[0]?.nombre_staff || '—'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
          {/* Registros x Staff */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} /> Top Staff por Registro
              </div>
              <ExportButton data={data?.staffPerformance || []} filename="registros_staff" />
            </div>
            <table className="crm-table">
              <thead><tr><th>#</th><th>Nombre del Staff</th><th style={{ textAlign: 'center' }}>Registros</th><th style={{ textAlign: 'center' }}>Tiendas</th></tr></thead>
              <tbody>
                {data?.staffPerformance?.map((row: any, i: number) => (
                  <tr key={row.nombre_staff}>
                    <td>{i+1}</td>
                    <td style={{ fontWeight: 500 }}>{row.nombre_staff}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-green">{row.total_registros}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.tiendas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Verificaciones x Staff */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={16} /> Verificaciones Validadas
              </div>
              <ExportButton data={data?.verificationPerformance || []} filename="verificaciones_staff" />
            </div>
            <table className="crm-table">
              <thead><tr><th>#</th><th>Staff</th><th style={{ textAlign: 'right' }}>Verificaciones</th></tr></thead>
              <tbody>
                {data?.verificationPerformance?.map((row: any, i: number) => (
                  <tr key={row.nombre_staff}>
                    <td>{i+1}</td>
                    <td style={{ fontSize: 13 }}>{row.nombre_staff}</td>
                    <td style={{ textAlign: 'right' }}><span className="badge badge-yellow">{row.verificaciones}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SecurityVault>
  );
}
