'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';

interface SecurityVaultProps {
  children: React.ReactNode;
}

export function SecurityVault({ children }: SecurityVaultProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state on mount to ensure "always ask" behavior when navigating back
  useEffect(() => {
    setIsUnlocked(false);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsUnlocked(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Acceso denegado');
      }
    } catch (err) {
      setError('Error de comunicación');
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[500px] w-full flex items-center justify-center p-6 mt-12 mb-12">
      {/* Background with content blurred */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl z-20 rounded-3xl" />
      
      {/* Vault Card (Apple Style) */}
      <div className="relative z-30 w-full max-w-[420px] bg-white rounded-[28px] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0071e3]/10 rounded-full mb-6">
            <Lock className="text-[#0071e3]" size={32} />
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight mb-3">
            Bóveda de Seguridad
          </h2>
          <p className="text-[17px] text-[#86868b] leading-snug">
            Este módulo contiene información sensible de Cloe. Ingresa la clave maestra para continuar.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Firma electrónica / Clave"
              className="w-full bg-[#f5f5f7] border-none rounded-xl px-4 py-4 text-[17px] text-[#1d1d1f] placeholder:text-[#86868b]/40 focus:ring-2 focus:ring-[#0071e3] transition-all outline-none text-center tracking-widest"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-[#e30000] text-[14px] font-medium animate-shake">
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1d1d1f] hover:bg-black active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-[17px] shadow-lg shadow-black/10"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Desbloquear Módulo</span>
                <ChevronRight size={18} strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-widest">
            Acceso Registrado y Auditado
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
}
