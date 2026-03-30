'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, GitBranch, UserCheck, Store, Sun, Moon, ShieldAlert, BadgeCheck, Heart } from 'lucide-react';
import { useTheme } from '@/lib/theme';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/funnel', label: 'Embudo', icon: GitBranch },
  { href: '/admin/customers', label: 'Clientes', icon: Users },
  { href: '/admin/sellers', label: 'Vendedores', icon: UserCheck },
  { href: '/admin/fraud', label: 'Auditoría', icon: ShieldAlert },
  { href: '/admin/staff', label: 'Staff', icon: BadgeCheck },
  { href: '/admin/loyalty', label: 'Fidelidad', icon: Heart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 180, background: 'var(--bg)', borderRight: '1px solid var(--border)',
        position: 'fixed', inset: '0 auto 0 0',
        display: 'flex', flexDirection: 'column', zIndex: 40,
      }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.5px' }}>CLOE</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CRM Admin</div>
        </div>
        <div style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`sidebar-link ${pathname === href ? 'active' : ''}`}>
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
        <div style={{ padding: '8px 6px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/tienda" className="sidebar-link"><Store size={15} /> Tiendas</Link>
          <button onClick={toggle} className="sidebar-link" style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit' }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </nav>
      <main style={{ marginLeft: 180, flex: 1, background: 'var(--bg)', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
