// src/components/AppNav.tsx
import {
  LayoutDashboard, CreditCard, CalendarCheck, BarChart3,
  FileSearch, LogOut, Sun, Moon, Landmark, TrendingUp, Target,
  Sparkles, MoreHorizontal, LucideIcon, X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getActiveModuleIds, AVAILABLE_MODULES } from '@/lib/modules';

const MODULE_ICONS: Record<string, LucideIcon> = { Landmark, TrendingUp, Target };

// ── 5 tabs principais — sempre visíveis ───────────────────────────────────────
const MAIN_TABS = [
  { path: '/',        label: 'Início',     icon: LayoutDashboard },
  { path: '/cards',   label: 'Cartões',    icon: CreditCard      },
  { path: '/fixed',   label: 'Fixos',      icon: CalendarCheck   },
  { path: '/faturas', label: 'Faturas',    icon: FileSearch      },
  { path: '/reports', label: 'Relatórios', icon: BarChart3       },
];

export default function AppNav() {
  const location            = useLocation();
  const navigate            = useNavigate();
  const { theme, setTheme } = useTheme();
  const [userName, setUserName]               = useState('');
  const [mounted, setMounted]                 = useState(false);
  const [activeModuleIds, setActiveModuleIds] = useState<string[]>([]);
  const [moreOpen, setMoreOpen]               = useState(false);

  const loadModules = async () => {
    try { setActiveModuleIds(await getActiveModuleIds()); }
    catch { /* silencioso */ }
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) =>
      setUserName(user?.user_metadata?.name ?? ''));
    loadModules();
  }, []);

  useEffect(() => { loadModules(); }, [location.pathname]);

  // Fecha o "Mais" ao trocar de rota
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const moduleTabs = AVAILABLE_MODULES
    .filter(m => activeModuleIds.includes(m.id))
    .map(m => ({ path: m.path, label: m.label, icon: MODULE_ICONS[m.icon] ?? Sparkles }));

  // Tabs que ficam no sheet "Mais": módulos ativos + Módulos (gerenciar) + Tema + Sair
  const moreTabs = [
    ...moduleTabs,
    { path: '/modules', label: 'Módulos', icon: Sparkles },
  ];

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isDark      = mounted ? theme === 'dark' : true;

  const iconSrc = '/financeflow-icon-purple-bg.svg';

  // Verifica se alguma tab do "Mais" está ativa (para destacar o botão Mais)
  const moreIsActive = moreTabs.some(t => location.pathname === t.path);

  const LogoutDialog = ({ children }: { children: React.ReactNode }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border max-w-xs">
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da conta</AlertDialogTitle>
          <AlertDialogDescription>
            {userName ? `Até logo, ${userName.split(' ')[0]}!` : 'Deseja sair?'} Você precisará fazer login novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => { await logoutUser(); }}>Sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP — Sidebar lateral fixa
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40">
        <div className="flex flex-col items-center justify-center py-6 px-4 border-b border-sidebar-border">
          <img src={iconSrc} alt="FinanceFlow" className="w-12 h-12 rounded-xl object-cover" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {[...MAIN_TABS, ...moduleTabs, { path: '/modules', label: 'Módulos', icon: Sparkles }].map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                )}
              >
                <tab.icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
            {isDark ? 'Modo claro' : 'Modo escuro'}
          </button>
          <LogoutDialog>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
              <LogOut size={18} strokeWidth={1.8} />Sair
            </button>
          </LogoutDialog>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE — Barra inferior fixa com 5 tabs + botão "Mais"
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
        <div className="flex items-center h-16">

          {/* 5 tabs principais — sempre visíveis, distribuídas igualmente */}
          {MAIN_TABS.map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 h-full transition-colors relative',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
                )}
                <tab.icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* Botão "Mais" — abre sheet com o restante */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 h-full transition-colors relative',
              moreOpen || moreIsActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {(moreOpen || moreIsActive) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
            )}
            {moreOpen
              ? <X size={21} strokeWidth={2} />
              : <MoreHorizontal size={21} strokeWidth={1.8} />
            }
            <span className="text-[9px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          Sheet "Mais" — abre acima da bottom nav
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 z-40 bg-black/40"
              onClick={() => setMoreOpen(false)}
            />

            {/* Painel */}
            <motion.div
              key="panel"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0,      opacity: 1 }}
              exit={{ y: '100%',    opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-card border border-border border-b-0 rounded-t-3xl shadow-2xl px-4 pt-4 pb-6"
            >
              {/* Handle */}
              <div className="w-8 h-1 rounded-full bg-border mx-auto mb-4" />

              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Mais opções
              </p>

              <div className="grid grid-cols-4 gap-2">
                {/* Tabs de módulos */}
                {moreTabs.map(tab => {
                  const active = location.pathname === tab.path;
                  return (
                    <button
                      key={tab.path}
                      onClick={() => navigate(tab.path)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-medium transition-all border',
                        active
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/80',
                      )}
                    >
                      <tab.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                      <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                  );
                })}

                {/* Tema */}
                <button
                  onClick={toggleTheme}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-medium bg-secondary text-muted-foreground border border-transparent hover:text-foreground transition-all"
                >
                  {isDark ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
                  <span className="text-[10px] font-medium">{isDark ? 'Claro' : 'Escuro'}</span>
                </button>

                {/* Sair */}
                <LogoutDialog>
                  <button className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-medium bg-secondary text-muted-foreground border border-transparent hover:text-destructive hover:bg-destructive/10 transition-all">
                    <LogOut size={20} strokeWidth={1.8} />
                    <span className="text-[10px] font-medium">Sair</span>
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