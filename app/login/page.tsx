'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Loader2, ShieldCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/admin';
  
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isStoreLogin = redirect.startsWith('/tienda');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isStoreLogin ? '/api/auth/login-tienda' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.error || 'Contraseña inválida');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] flex flex-col items-center justify-center p-6 font-sans antialiased text-[#1d1d1f]">
      <div className="w-full max-w-[360px] animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Minimalist Logo/Brand */}
        <div className="text-center mb-16">
          <h1 className="text-[32px] font-medium tracking-[0.2em] uppercase mb-2">
            CLOE
          </h1>
          <div className="h-[1px] w-8 bg-[#1d1d1f]/10 mx-auto mb-10" />
          <p className="text-[17px] text-[#86868b] font-normal tracking-tight">
            {isStoreLogin ? 'Portal de Tiendas' : 'Gestión Corporativa'}
          </p>
        </div>

        {/* Login Card */}
        <div className="space-y-12">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="relative border-b border-[#d2d2d7] focus-within:border-[#0071e3] transition-colors duration-300">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isStoreLogin ? "Clave de Tienda" : "Contraseña"}
                className="w-full bg-transparent border-none py-4 text-[21px] text-[#1d1d1f] placeholder:text-[#d2d2d7] outline-none transition-all placeholder:font-normal font-light tracking-widest"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="animate-in fade-in duration-300">
                <p className="text-[#e30000] text-[13px] text-center font-normal">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#0071e3] hover:bg-[#0077ed] active:opacity-80 disabled:opacity-30 text-white font-medium rounded-full flex items-center justify-center gap-1 transition-all text-[15px] shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span>Continuar</span>
                  <ChevronRight size={14} strokeWidth={3} />
                </>
              )}
            </button>
          </form>

          <p className="text-[14px] text-center text-[#06c] hover:underline cursor-pointer font-normal">
            ¿Olvidaste la contraseña?
          </p>
        </div>

        {/* Footer */}
        <div className="mt-32 text-center">
          <p className="text-[12px] text-[#86868b] font-normal tracking-tight">
            Seguridad Cloe Corporate &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
