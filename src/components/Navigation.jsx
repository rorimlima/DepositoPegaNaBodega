'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, UserCog } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import clsx from 'clsx';
import { useEffect } from 'react';

// Definição das rotas e quais roles podem acessar
const allNavItems = [
  { name: 'Dashboard', href: '/',         icon: LayoutDashboard, roles: ['admin'] },
  { name: 'PDV',       href: '/pdv',      icon: ShoppingCart,    roles: ['admin', 'operador'] },
  { name: 'Clientes',  href: '/clientes', icon: Users,           roles: ['admin'] },
  { name: 'Produtos',  href: '/produtos', icon: Package,         roles: ['admin'] },
  { name: 'Usuários',  href: '/usuarios', icon: UserCog,         roles: ['admin'] },
  { name: 'Empresa',   href: '/empresa',  icon: Settings,        roles: ['admin'] },
];

function useNavItems() {
  const { usuario } = useAuth();
  return allNavItems.filter(item => item.roles.includes(usuario?.role));
}

// ── Redirect operador para PDV se tentar acessar rota proibida ───────────────
export function RouteGuard({ children }) {
  const { usuario, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !usuario) return;
    if (usuario.role === 'operador' && pathname !== '/pdv') {
      router.replace('/pdv');
    }
  }, [pathname, usuario, loading, router]);

  return <>{children}</>;
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname  = usePathname();
  const navItems  = useNavItems();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-slate-950 border-r border-slate-800 text-slate-400 h-full shrink-0">
      <div className="p-5 border-b border-slate-800/50">
        <h2 className="text-xl font-black text-blue-500 tracking-tighter leading-none">SDO</h2>
        <p className="text-[10px] text-slate-600 mt-0.5 leading-none">Seu Deposito Online</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-sm font-medium',
                active ? 'bg-blue-500/15 text-blue-400' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-100'
              )}
            >
              <Icon size={18} className={active ? 'text-blue-400' : ''} />
              {name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Mobile Bottom Nav ────────────────────────────────────────────────────────
export function BottomNav() {
  const pathname = usePathname();
  const navItems = useNavItems();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800">
      <div className="flex items-stretch justify-around" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 py-2 flex-1 min-h-[58px] transition-colors',
                active ? 'text-blue-500' : 'text-slate-600 active:text-slate-300'
              )}
            >
              <div className={clsx('p-1.5 rounded-xl transition-all', active && 'bg-blue-500/15')}>
                <Icon size={21} />
              </div>
              <span className={clsx('text-[10px] font-semibold', active ? 'text-blue-400' : 'text-slate-600')}>
                {name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
