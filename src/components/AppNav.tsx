// src/components/AppNav.tsx
import {
  LayoutDashboard, CreditCard, CalendarCheck, BarChart3, FileSearch,
  LogOut, Sun, Moon, Landmark, TrendingUp, Target, Sparkles,
  MoreHorizontal, LucideIcon, X, Repeat2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AVAILABLE_MODULES } from '@/lib/modules';
import { useFinanceData } from '@/contexts/FinanceDataContext';

const MODULE_ICONS: Record<string, LucideIcon> = { Landmark, TrendingUp, Target, Repeat2 };

const MAIN_TABS = [
  { path: '/',        label: 'Início',     icon: LayoutDashboard },
  { path: '/cards',   label: 'Cartões',    icon: CreditCard      },
  { path: '/fixed',   label: 'Fixos',      icon: CalendarCheck   },
  { path: '/faturas', label: 'Faturas',    icon: FileSearch      },
  { path: '/reports', label: 'Relatórios', icon: BarChart3       },
];

const EXPANDED_W  = 240; // px — sidebar expandida
const COLLAPSED_W = 68;  // px — sidebar recolhida (só ícones)
const GAP         = 12;  // px — margem da sidebar flutuante

export default function AppNav() {
  const location             = useLocation();
  const navigate             = useNavigate();
  const { theme, setTheme }  = useTheme();
  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [mounted, setMounted]     = useState(false);
  const [moreOpen, setMoreOpen]   = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nav-collapsed') === '1'; } catch { return false; }
  });
  const { activeModuleIds } = useFinanceData();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserName(user?.user_metadata?.name ?? '');
      setUserEmail(user?.email ?? '');
    });
  }, []);

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  // Sincronizar CSS var com o estado collapsed
  useEffect(() => {
    const w = collapsed
      ? `${COLLAPSED_W + GAP * 2}px`
      : `${EXPANDED_W + GAP * 2}px`;
    document.documentElement.style.setProperty('--sidebar-w', w);
    try { localStorage.setItem('nav-collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  const toggleCollapse = useCallback(() => setCollapsed(v => !v), []);

  const moduleTabs = AVAILABLE_MODULES
    .filter(m => activeModuleIds.includes(m.id))
    .map(m => ({ path: m.path, label: m.label, icon: MODULE_ICONS[m.icon] ?? Sparkles }));

  const moreTabs   = [...moduleTabs, { path: '/modules', label: 'Módulos', icon: Sparkles }];
  const toggleTheme  = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isDark       = mounted ? theme === 'dark' : true;
  const moreIsActive = moreTabs.some(t => location.pathname === t.path);
  const initials     = userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'FF';
  const firstName    = userName.split(' ')[0] || '';

  // ── Item de navegação ──────────────────────────────────────────────────────
  const NavItem = ({ tab, delay = 0 }: { tab: { path: string; label: string; icon: LucideIcon }; delay?: number }) => {
    const active = location.pathname === tab.path;

    const btn = (
      <motion.button
        onClick={() => navigate(tab.path)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.2 }}
        className={cn(
          'w-full flex items-center rounded-xl transition-all duration-200 relative group',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          active
            ? 'text-primary font-semibold'
            : 'text-sidebar-foreground/55 hover:text-sidebar-foreground',
        )}
        style={{
          background: active
            ? 'linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)'
            : undefined,
          border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'hsl(var(--sidebar-accent))'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-lg shrink-0 transition-all',
            collapsed ? 'w-8 h-8' : 'w-7 h-7',
            active ? 'bg-primary/15' : '',
          )}
        >
          <tab.icon size={16} strokeWidth={active ? 2.3 : 1.8} />
        </span>
        {!collapsed && <span className="text-sm font-medium">{tab.label}</span>}
        {/* Dot quando ativo */}
        {active && !collapsed && (
          <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </motion.button>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{tab.label}</TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  const LogoutDialog = ({ children }: { children: React.ReactNode }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border rounded-2xl max-w-xs">
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da conta</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {firstName ? `Até logo, ${firstName}!` : 'Deseja sair?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => { await logoutUser(); }}
            className="rounded-xl bg-destructive hover:bg-destructive/90"
          >
            Sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      {/* ════════════════════════════════════════
          DESKTOP — Sidebar flutuante e arredondada
      ════════════════════════════════════════ */}
      <motion.aside
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col fixed z-40 overflow-hidden"
        style={{
          top: GAP,
          left: GAP,
          bottom: GAP,
          borderRadius: 20,
          background: 'hsl(var(--sidebar-background))',
          border: '1px solid hsl(var(--sidebar-border))',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* ── Logo ── */}
        <div
          className={cn(
            'flex items-center py-5 shrink-0 overflow-hidden',
            collapsed ? 'justify-center px-0' : 'px-4 gap-3',
          )}
          style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}
        >
          <img
            src="/financeflow-icon-purple-bg.svg"
            alt="FinanceFlow"
            className="w-9 h-9 rounded-xl object-cover shadow-md shrink-0"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden min-w-0"
              >
                <p className="font-bold text-[15px] text-sidebar-foreground leading-tight whitespace-nowrap">FinanceFlow</p>
                {firstName && (
                  <p className="text-[11px] text-muted-foreground/60 whitespace-nowrap">{firstName}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Nav ── */}
        <nav
          className={cn('flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2' : 'px-3')}
          style={{ scrollbarWidth: 'none' }}
        >
          {!collapsed && (
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 pb-1.5 text-muted-foreground/40">
              Principal
            </p>
          )}
          {MAIN_TABS.map((tab, i) => <NavItem key={tab.path} tab={tab} delay={i * 0.03} />)}

          {moduleTabs.length > 0 && (
            <>
              <div className="h-px bg-border/40 my-2 mx-1" />
              {!collapsed && (
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 pb-1.5 text-muted-foreground/40">
                  Módulos
                </p>
              )}
              {moduleTabs.map((tab, i) => <NavItem key={tab.path} tab={tab} delay={0.18 + i * 0.03} />)}
            </>
          )}

          <div className="h-px bg-border/40 my-2 mx-1" />
          <NavItem tab={{ path: '/modules', label: 'Módulos', icon: Sparkles }} delay={0.28} />
        </nav>

        {/* ── Footer ── */}
        <div
          className={cn('py-3 shrink-0', collapsed ? 'px-2' : 'px-3')}
          style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}
        >
          {/* Avatar / user info */}
          {!collapsed ? (
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2"
              style={{ background: 'hsl(var(--sidebar-accent) / 0.6)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #333333, #111111)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-sidebar-foreground truncate leading-tight">{firstName || 'Usuário'}</p>
                <p className="text-[10px] text-muted-foreground/55 truncate">{userEmail}</p>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white mx-auto mb-2 cursor-default"
                  style={{ background: 'linear-gradient(135deg, #333333, #111111)' }}
                >
                  {initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{firstName || 'Usuário'}</TooltipContent>
            </Tooltip>
          )}

          {/* Tema + Sair */}
          <div className={cn('flex', collapsed ? 'flex-col gap-1' : 'gap-1.5')}>
            {collapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleTheme}
                      className="w-full flex justify-center py-2 rounded-xl text-muted-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                    >
                      {isDark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{isDark ? 'Modo claro' : 'Modo escuro'}</TooltipContent>
                </Tooltip>
                <LogoutDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-full flex justify-center py-2 rounded-xl text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all">
                        <LogOut size={15} strokeWidth={1.8} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sair</TooltipContent>
                  </Tooltip>
                </LogoutDialog>
              </>
            ) : (
              <>
                <button
                  onClick={toggleTheme}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-muted-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                >
                  {isDark ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
                  {isDark ? 'Claro' : 'Escuro'}
                </button>
                <LogoutDialog>
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all">
                    <LogOut size={14} strokeWidth={1.8} /> Sair
                  </button>
                </LogoutDialog>
              </>
            )}
          </div>
        </div>

        {/* ── Botão collapse — aba pill na lateral direita ── */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-4 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-50"
          style={{
            width: 18,
            height: 48,
            borderRadius: '0 10px 10px 0',
            background: 'hsl(var(--sidebar-background))',
            border: '1px solid hsl(var(--sidebar-border))',
            borderLeft: 'none',
            boxShadow: '4px 0 12px rgba(0,0,0,0.15)',
            color: 'hsl(var(--muted-foreground))',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'hsl(var(--sidebar-foreground))'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            <ChevronRight size={11} />
          </motion.span>
        </button>
      </motion.aside>

      {/* ════════════════════════════════════════
          MOBILE — Bottom nav
      ════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'hsl(var(--sidebar-background) / 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid hsl(var(--sidebar-border))',
        }}
      >
        <div className="flex items-center h-16">
          {MAIN_TABS.map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 h-full relative transition-all"
                style={{ color: active ? '#e5e5e5' : 'hsl(var(--muted-foreground))' }}
              >
                {active && (
                  <motion.span
                    layoutId="mob-pip"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: '#a3a3a3' }}
                  />
                )}
                <tab.icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 h-full relative transition-all"
            style={{ color: moreOpen || moreIsActive ? '#e5e5e5' : 'hsl(var(--muted-foreground))' }}
          >
            {(moreOpen || moreIsActive) && (
              <motion.span
                layoutId="mob-pip"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: '#a3a3a3' }}
              />
            )}
            {moreOpen ? <X size={20} strokeWidth={2} /> : <MoreHorizontal size={20} strokeWidth={1.7} />}
            <span className="text-[9px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════════
          SHEET MAIS
      ════════════════════════════════════════ */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="ov"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="pn"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="md:hidden fixed bottom-16 left-0 right-0 z-50 rounded-t-3xl px-4 pt-3 pb-8 bg-card border border-border border-b-0 shadow-2xl"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              <div className="grid grid-cols-4 gap-2">
                {moreTabs.map(tab => {
                  const active = location.pathname === tab.path;
                  return (
                    <button
                      key={tab.path}
                      onClick={() => navigate(tab.path)}
                      className="flex flex-col items-center gap-2 py-3 rounded-2xl text-xs font-medium transition-all border"
                      style={{
                        background: active ? 'rgba(255,255,255,0.10)' : 'hsl(var(--secondary))',
                        border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                        color: active ? '#e5e5e5' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      <tab.icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                      <span className="text-[9px]">{tab.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={toggleTheme}
                  className="flex flex-col items-center gap-2 py-3 rounded-2xl text-xs bg-secondary text-muted-foreground transition-all"
                >
                  {isDark ? <Sun size={20} strokeWidth={1.7} /> : <Moon size={20} strokeWidth={1.7} />}
                  <span className="text-[9px]">{isDark ? 'Claro' : 'Escuro'}</span>
                </button>
                <LogoutDialog>
                  <button
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl text-xs transition-all"
                    style={{ background: 'hsl(var(--destructive) / 0.08)', border: '1px solid hsl(var(--destructive) / 0.2)', color: 'hsl(var(--destructive))' }}
                  >
                    <LogOut size={20} strokeWidth={1.7} />
                    <span className="text-[9px]">Sair</span>
                  </button>
                </LogoutDialog>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}