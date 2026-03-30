'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';

interface Order {
  folio: string;
  fecha_venta: string;
  venta_importe: number;
  email: string;
  tienda: string;
  registro: string;
}

interface SellerDetail {
  name: string;
  totalVenta: number;
  totalOrdenes: number;
  totalRegistrados: number;
  ticketPromedio: number;
  tasaConversion: number;
}

export default function SellerDetailPage({ params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = use(paramsPromise);
  const sellerName = decodeURIComponent(params.name);
  const searchParams = useSearchParams();
  const inicio = searchParams.get('inicio') || '2024-01-01';
  const fin = searchParams.get('fin') || '2026-12-31';

  const [data, setData] = useState<{ seller: SellerDetail; orders: Order[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/sellers/${encodeURIComponent(sellerName)}?inicio=${inicio}&fin=${fin}`);
      if (!res.ok) throw new Error('Error al cargar detalle del vendedor');
      const d = await res.json();
      setData(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sellerName, inicio, fin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-8 text-black dark:text-white">Cargando detalle...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!data) return null;

  const { seller, orders } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-4 border-black dark:border-white">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter text-black dark:text-white">
            {seller.name}
          </h1>
          <p className="text-sm opacity-60">Rendimiento Detallado por Vendedor</p>
        </div>
        <Link 
          href="/admin/sellers" 
          className="px-4 py-2 border border-black dark:border-white text-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          ← VOLVER
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI className="border-black dark:border-white" label="Venta Total" value={`$${seller.totalVenta.toLocaleString()}`} />
        <KPI className="border-black dark:border-white" label="Ticket Promedio" value={`$${seller.ticketPromedio.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <KPI className="border-black dark:border-white" label="Ordenes" value={seller.totalOrdenes} />
        <KPI className="border-black dark:border-white" label="Conv. Registro" value={`${seller.tasaConversion.toFixed(1)}%`} progress={seller.tasaConversion} />
      </div>

      <div className="bg-white dark:bg-black border border-black dark:border-white">
        <div className="p-4 border-b border-black dark:border-white bg-gray-50 dark:bg-zinc-900 flex justify-between items-center">
            <h2 className="font-bold uppercase text-sm">Historial de Transacciones</h2>
            <span className="text-xs uppercase opacity-50">{orders.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="uppercase border-b border-black dark:border-white text-xs">
                <th className="p-4 font-bold">Folio</th>
                <th className="p-4 font-bold">Fecha</th>
                <th className="p-4 font-bold">Tienda</th>
                <th className="p-4 font-bold">Venta</th>
                <th className="p-4 font-bold">Email</th>
                <th className="p-4 font-bold text-center">Registro</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={i} className="border-b border-black/10 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
                  <td className="p-4 font-mono">{order.folio}</td>
                  <td className="p-4">{new Date(order.fecha_venta).toLocaleDateString()}</td>
                  <td className="p-4">{order.tienda}</td>
                  <td className="p-4 font-bold">${order.venta_importe.toLocaleString()}</td>
                  <td className="p-4 opacity-70">{order.email || '-'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-[10px] uppercase font-bold border ${
                      order.registro === 'Registrado' 
                      ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white' 
                      : 'border-black/30 dark:border-white/30 opacity-50'
                    }`}>
                      {order.registro}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, progress, className }: { label: string; value: any; progress?: number; className?: string }) {
  return (
    <div className={`p-6 border bg-white dark:bg-black ${className}`}>
      <p className="text-[10px] uppercase font-bold opacity-50 mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tighter">{value}</p>
      {progress !== undefined && (
        <div className="mt-4 h-1 w-full bg-gray-100 dark:bg-zinc-800">
          <div className="h-full bg-black dark:bg-white transition-all duration-1000" style={{ width: `${Math.min(100, progress)}%` }}></div>
        </div>
      )}
    </div>
  );
}
