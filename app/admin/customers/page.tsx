'use client';
import { useState } from 'react';
import { Search, User, Phone, MapPin, Calendar, Tag, Mail, ShoppingBag } from 'lucide-react';

export default function CustomersPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [ordenes, setOrdenes] = useState<Record<string, unknown>[]>([]);
  const [registros, setRegistros] = useState<Record<string, unknown>[]>([]);
  const [source, setSource] = useState('');
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError(''); setProfile(null); setOrdenes([]); setRegistros([]); setSearched(true);
    try {
      const res = await fetch(`/api/admin/customers?email=${encodeURIComponent(email.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfile(json.profile);
      setOrdenes(json.ordenes || []);
      setRegistros(json.registros || []);
      setSource(json.source || '');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  const rfm = profile?.rfm_totalPurchaseValue
    ? (typeof profile.rfm_totalPurchaseValue === 'string'
        ? parseFloat(profile.rfm_totalPurchaseValue as string)
        : (profile.rfm_totalPurchaseValue as number)) / 100
    : null;

  const tags = profile?.tags
    ? String(profile.tags).split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Clientes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Busca por correo · Guper API + Base de datos</p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 28, maxWidth: 480 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="email" placeholder="correo@ejemplo.com" value={email}
            onChange={e => setEmail(e.target.value)} className="crm-input" style={{ width: '100%', paddingLeft: 32 }} />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          <Search size={14} /> {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Buscando en Guper API y base de datos...
        </div>
      )}

      {searched && !loading && !profile && !error && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <User size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
          <p style={{ fontWeight: 500, color: 'var(--text)' }}>No encontrado</p>
          <p style={{ fontSize: 13 }}>Sin resultados para <strong>{email}</strong></p>
        </div>
      )}

      {profile && !loading && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Source */}
          <div>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
              background: source === 'guper_api' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
              color: source === 'guper_api' ? '#3b82f6' : '#22c55e',
            }}>
              {source === 'guper_api' ? 'Guper API' : 'Base de datos'}
            </span>
          </div>

          {/* Profile + RFM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)',
                }}>
                  {(String(profile.name || profile.email || 'C')).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{String(profile.name || 'Sin nombre')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{String(profile.email || '')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: <Phone size={12} />, label: 'Teléfono', value: profile.cellphone },
                  { icon: <User size={12} />, label: 'Género', value: profile.gender },
                  { icon: <MapPin size={12} />, label: 'C.P.', value: profile.postalCode },
                  { icon: <Calendar size={12} />, label: 'Nacimiento', value: profile.dateOfBirth ? new Date(String(profile.dateOfBirth)).toLocaleDateString('es-MX') : null },
                  { icon: <Calendar size={12} />, label: 'Registro', value: profile.createdAt ? new Date(String(profile.createdAt)).toLocaleDateString('es-MX') : null },
                ].map(({ icon, label, value }) => value ? (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
                    <span style={{ color: 'var(--text-muted)', width: 80 }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{String(value)}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Métricas RFM</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Compras', value: profile.rfm_totalPurchases ?? '—' },
                  { label: 'Días sin compra', value: profile.rfm_daysWithoutPurchase ?? '—' },
                  { label: 'Valor Total', value: rfm != null ? `$${rfm.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—' },
                  { label: 'ID', value: profile.id ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{String(value)}</div>
                  </div>
                ))}
              </div>
              {tags.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tag size={10} /> Tags
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Registros */}
          {registros.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
                Registros <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{registros.length}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="crm-table">
                  <thead><tr><th>Folio</th><th>Estado</th><th>Tienda</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {registros.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{String(r.folio)}</td>
                        <td><span className={`estado-badge ${
                          String(r.estado).includes('Nuevo') ? 'estado-nuevo' :
                          String(r.estado).includes('Tag') ? 'estado-sin-tag' : ''
                        }`}>{String(r.estado)}</span></td>
                        <td style={{ fontSize: 12 }}>{String(r.tienda)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{String(r.fechaBase || r.fecha || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Órdenes */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={14} /> Órdenes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{ordenes.length}</span>
            </div>
            {ordenes.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin órdenes encontradas</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="crm-table">
                  <thead><tr><th>Folio</th><th>Tienda</th><th>Cliente</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {ordenes.map((o, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{String(o.folio)}</td>
                        <td style={{ fontSize: 12 }}>{String(o.tienda || '')}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{String(o.clientenetsuite || '')}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{String(o.created_date || '')}</td>
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
  );
}
