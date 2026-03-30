import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── ZONA ADMIN ── Solo entra con cloe_admin_session
  if (pathname.startsWith('/admin')) {
    const adminSession = request.cookies.get('cloe_admin_session');
    if (!adminSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      // Borra la cookie de tienda por si acaso existe en el navegador
      const res = NextResponse.redirect(url);
      res.cookies.delete('cloe_tienda_session');
      return res;
    }
  }

  // ── ZONA TIENDA ── Solo entra con cloe_tienda_session
  if (pathname.startsWith('/tienda')) {
    const tiendaSession = request.cookies.get('cloe_tienda_session');
    if (!tiendaSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      // Borra la cookie de admin por si acaso existe en el navegador
      const res = NextResponse.redirect(url);
      res.cookies.delete('cloe_admin_session');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/tienda/:path*'],
};
