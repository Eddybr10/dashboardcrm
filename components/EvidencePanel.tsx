'use client';
import { X, ShieldAlert, FileText, Calendar, DollarSign, User } from 'lucide-react';

interface EvidencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
}

export default function EvidencePanel({ isOpen, onClose, title, data }: EvidencePanelProps) {
  if (!isOpen) return null;

  // Evidence is usually a string separated by " | "
  const rawEvidence = data?.evidence || data?.folios_list || '';
  const evidenceItems = rawEvidence.split(' | ').filter(Boolean);

  return (
    <div className="evidence-overlay" onClick={onClose}>
      <div className="evidence-panel" onClick={e => e.stopPropagation()}>
        <div className="evidence-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="evidence-icon-bg">
              <ShieldAlert size={20} color="var(--red)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Expediente de Evidencia</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{title}</p>
            </div>
          </div>
          <button className="evidence-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="evidence-body">
          <div className="evidence-summary-card">
            <div className="summary-item">
              <span className="summary-label">Sujeto / Correo</span>
              <span className="summary-value">{data?.correo || data?.prefijo || data?.vendedor || data?.phone || 'N/A'}</span>
            </div>
            {data?.vendedores_distintos && (
              <div className="summary-item">
                <span className="summary-label">Cajeros Involucrados</span>
                <span className="summary-value">{data.vendedores_distintos}</span>
              </div>
            )}
            {data?.total_venta && (
              <div className="summary-item">
                <span className="summary-label">Monto Total Comprometido</span>
                <span className="summary-value" style={{ color: 'var(--red)', fontWeight: 700 }}>
                  ${Number(data.total_venta).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} /> Registros Encontrados ({evidenceItems.length})
            </h3>
            
            <div className="evidence-list">
              {evidenceItems.map((item: string, i: number) => (
                <div key={i} className="evidence-item">
                  <div className="evidence-dot" />
                  <div className="evidence-item-content">
                    <span className="evidence-text">{item}</span>
                  </div>
                </div>
              ))}

              {evidenceItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  No hay folios específicos adjuntos a este registro.
                </div>
              )}
            </div>
          </div>

          {data?.lista_vendedores && (
            <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} /> Personal de Ventas Relacionado
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {data.lista_vendedores}
              </div>
            </div>
          )}
        </div>

        <div className="evidence-footer">
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            * Estos datos provienen directamente de Azure SQL (Base de POS) y constituyen prueba documental para Auditoría.
          </p>
        </div>
      </div>

      <style jsx>{`
        .evidence-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.3s ease;
        }

        .evidence-panel {
          width: 450px;
          height: 100%;
          background: white;
          box-shadow: -10px 0 30px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease;
        }

        .evidence-header {
          padding: 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .evidence-icon-bg {
          width: 40px;
          height: 40px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .evidence-close {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .evidence-close:hover {
          background: rgba(0,0,0,0.05);
          color: var(--text);
        }

        .evidence-body {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .evidence-summary-card {
          background: #111;
          color: white;
          padding: 20px;
          border-radius: 16px;
        }

        .summary-item {
          margin-bottom: 12px;
        }

        .summary-item:last-child {
          margin-bottom: 0;
        }

        .summary-label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          opacity: 0.6;
          margin-bottom: 4px;
          font-weight: 600;
        }

        .summary-value {
          display: block;
          font-size: 15px;
          font-weight: 500;
        }

        .evidence-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .evidence-item {
          padding: 12px 16px;
          background: rgba(0,0,0,0.02);
          border: 1px solid var(--border);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .evidence-dot {
          width: 6px;
          height: 6px;
          background: var(--red);
          border-radius: 50%;
        }

        .evidence-text {
          font-size: 13px;
          font-family: inherit;
          color: var(--text);
        }

        .evidence-footer {
          padding: 20px 24px;
          background: #f9fafb;
          border-top: 1px solid var(--border);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
