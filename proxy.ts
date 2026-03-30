import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas que requieren protección
  if (pathname.startsWith('/admin') || pathname.startsWith('/tienda')) {
    const session = request.cookies.get('cloe_session');

    if (!session) {
      // Si no hay sesión, redirigir al login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configurar en qué rutas se aplica el middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/tienda/:path*',
  ],
};
