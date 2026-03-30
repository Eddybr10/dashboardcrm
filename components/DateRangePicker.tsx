'use client';
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  inicio: string;
  fin: string;
  onChange: (inicio: string, fin: string) => void;
}

export default function DateRangePicker({ inicio, fin, onChange }: DateRangePickerProps) {
  const [localInicio, setLocalInicio] = useState(inicio);
  const [localFin, setLocalFin] = useState(fin);

  // Sync external props
  useEffect(() => {
    setLocalInicio(inicio);
    setLocalFin(fin);
  }, [inicio, fin]);

  const handleApply = () => {
    if (localInicio && localFin && localInicio <= localFin) {
      onChange(localInicio, localFin);
    }
  };

  const setPreset = (preset: '7d' | '30d' | 'esteMes' | 'mesPasado') => {
    const d = new Date();
    let end = new Date().toISOString().split('T')[0];
    let start = '';

    if (preset === '7d') {
      const s = new Date(); s.setDate(s.getDate() - 7);
      start = s.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const s = new Date(); s.setDate(s.getDate() - 30);
      start = s.toISOString().split('T')[0];
    } else if (preset === 'esteMes') {
      start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    } else if (preset === 'mesPasado') {
      start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
      // Last day of last month
      end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
    }

    setLocalInicio(start);
    setLocalFin(end);
    onChange(start, end);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setPreset('7d')} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>7d</button>
        <button onClick={() => setPreset('30d')} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>30d</button>
        <button onClick={() => setPreset('esteMes')} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Este Mes</button>
        <button onClick={() => setPreset('mesPasado')} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Mes Pasado</button>
      </div>
      
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calendar size={14} color="var(--text-muted)" />
        <input 
          type="date" 
          value={localInicio} 
          onChange={(e) => setLocalInicio(e.target.value)} 
          className="crm-input" 
          style={{ padding: '4px 8px', fontSize: 11, height: 26 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>al</span>
        <input 
          type="date" 
          value={localFin} 
          onChange={(e) => setLocalFin(e.target.value)} 
          className="crm-input"
          style={{ padding: '4px 8px', fontSize: 11, height: 26 }}
        />
        <button onClick={handleApply} className="btn" style={{ fontSize: 11, padding: '4px 12px', height: 26 }}>
          Aplicar
        </button>
      </div>
    </div>
  );
}
