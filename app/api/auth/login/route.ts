import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const cookieStore = await cookies();
    // Limpia la cookie de tienda si existe (no mezcles sesiones)
    cookieStore.delete('cloe_tienda_session');
    cookieStore.delete('cloe_session');
    // Establece la cookie exclusiva de admin
    cookieStore.set('cloe_admin_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
