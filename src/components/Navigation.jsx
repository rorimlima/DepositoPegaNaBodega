'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, Package,
  Settings, UserCog, Receipt, Landmark, Wallet,
  Menu, X
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

// Definição das rotas e quais roles podem acessar
const allNavItems = [
  { name: 'Dashboard',  href: '/',            icon: LayoutDashboard, roles: ['admin'] },
  { name: 'PDV',        href: '/pdv',         icon: ShoppingCart,    roles: ['admin', 'operador'] },
  { name: 'Vendas',     href: '/vendas',      icon: Receipt,         roles: ['admin'] },
  { name: 'Clientes',   href: '/clientes',    icon: Users,           roles: ['admin'] },
  { name: 'Produtos',   href: '/produtos',    icon: Package,         roles: ['admin'] },
  { name: 'Financeiro', href: '/financeiro',  icon: Landmark,        roles: ['admin'] },
  { name: 'Caixa',      href: '/caixa',       icon: Wallet,          roles: ['admin'] },
  { name: 'Usuários',   href: '/usuarios',    icon: UserCog,         roles: ['admin'] },
  { name: 'Empresa',    href: '/empresa',     icon: Settings,        roles: ['admin'] },
];

// Itens para a bottom nav (mobile) — máximo 4 para sobrar espaço para o botão "Mais/Menu"
const mobileNavPriority = ['/pdv', '/vendas', '/produtos', '/'];

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
    <aside
      className="hidden md:flex flex-col w-60 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 h-full shrink-0 transition-colors"
      role="navigation"
      aria-label="Menu principal"
    >
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/50">
        <h2 className="text-xl font-black text-blue-600 dark:text-blue-500 tracking-tighter leading-none">SDO</h2>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5 leading-none">Seu Depósito Online</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative',
                active
                  ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-100'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} className={active ? 'text-blue-600 dark:text-blue-400' : ''} />
              {name}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full animate-nav-pill" />
              )}
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
  const [menuAberto, setMenuAberto] = useState(false);

  // Itens que vão direto para a barra inferior (se o usuário tiver acesso)
  const itensPrincipais = navItems.filter(item => mobileNavPriority.includes(item.href));
  
  // Itens que sobram e vão para o menu "Mais" (se o usuário tiver acesso)
  const itensAdicionais = navItems.filter(item => !mobileNavPriority.includes(item.href));

  // Se houver itens adicionais, o botão "Mais" será exibido
  const temMais = itensAdicionais.length > 0;

  return (
    <>
      {/* Overlay do Drawer */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Drawer (Gaveta de Mais Opções) */}
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-6 pb-10 transition-transform duration-300 ease-out transform md:hidden shadow-2xl",
          menuAberto ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Mais Opções</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5 leading-none">Acesse outras áreas do sistema</p>
          </div>
          <button
            onClick={() => setMenuAberto(false)}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid de itens adicionais */}
        <div className="grid grid-cols-3 gap-3">
          {itensAdicionais.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuAberto(false)}
                className={clsx(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 text-center gap-2",
                  active
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold scale-[0.98]"
                    : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900/90 border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <div className={clsx(
                  "p-2 rounded-xl transition-all duration-200",
                  active ? "bg-blue-500/15" : "bg-white dark:bg-slate-950 shadow-sm border border-slate-200/40 dark:border-slate-800"
                )}>
                  <Icon size={18} className={active ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"} />
                </div>
                <span className="text-[10px] font-semibold leading-tight">
                  {name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Barra principal inferior */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 transition-colors"
        role="navigation"
        aria-label="Menu mobile"
      >
        <div className="flex items-stretch justify-around" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {itensPrincipais.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 py-2 flex-1 min-h-[58px] transition-all duration-200 relative',
                  active ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-600 active:text-slate-600 dark:active:text-slate-300'
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={name}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-b-full animate-nav-pill" />
                )}
                <div className={clsx(
                  'p-1.5 rounded-xl transition-all duration-200',
                  active && 'bg-blue-500/10 dark:bg-blue-500/15 scale-110'
                )}>
                  <Icon size={21} />
                </div>
                <span className={clsx(
                  'text-[10px] font-semibold transition-colors',
                  active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'
                )}>
                  {name}
                </span>
              </Link>
            );
          })}

          {/* Botão de Mais Opções */}
          {temMais && (
            <button
              onClick={() => setMenuAberto(true)}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 py-2 flex-1 min-h-[58px] transition-all duration-200 relative',
                menuAberto ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-600 active:text-slate-600 dark:active:text-slate-300'
              )}
              aria-label="Mais Opções"
            >
              <div className={clsx(
                'p-1.5 rounded-xl transition-all duration-200',
                menuAberto && 'bg-blue-500/10 dark:bg-blue-500/15 scale-110'
              )}>
                <Menu size={21} />
              </div>
              <span className={clsx(
                'text-[10px] font-semibold transition-colors',
                menuAberto ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'
              )}>
                Menu
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
