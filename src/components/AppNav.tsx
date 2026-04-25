import {
  LayoutDashboard, CreditCard, CalendarCheck, BarChart3,
  FileSearch, LogOut, Sun, Moon, Landmark, TrendingUp, Target, Sparkles, LucideIcon,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getActiveModuleIds, AVAILABLE_MODULES } from '@/lib/modules';

// ─── Mapa de ícones dos módulos ───────────────────────────────────────────────
const MODULE_ICONS: Record<string, LucideIcon> = { Landmark, TrendingUp, Target };

// ─── Abas fixas (sempre visíveis) ─────────────────────────────────────────────
const STATIC_TABS = [
  { path: '/',        label: 'Início',     icon: LayoutDashboard },
  { path: '/cards',   label: 'Cartões',    icon: CreditCard      },
  { path: '/fixed',   label: 'Fixos',      icon: CalendarCheck   },
  { path: '/faturas', label: 'Faturas',    icon: FileSearch      },
  { path: '/reports', label: 'Relatórios', icon: BarChart3       },
];

const MODULES_TAB = { path: '/modules', label: 'Módulos', icon: Sparkles };

export default function AppNav() {
  const location            = useLocation();
  const navigate            = useNavigate();
  const { theme, setTheme } = useTheme();
  const [userName, setUserName]         = useState('');
  const [mounted, setMounted]           = useState(false);
  const [activeModuleIds, setActiveModuleIds] = useState<string[]>([]);

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

  const moduleTabs = AVAILABLE_MODULES
    .filter(m => activeModuleIds.includes(m.id))
    .map(m => ({
      path:  m.path,
      label: m.label,
      icon:  MODULE_ICONS[m.icon] ?? Sparkles,
    }));

  const allTabs = [...STATIC_TABS, ...moduleTabs, MODULES_TAB];

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isDark      = mounted ? theme === 'dark' : true;

  // ── Logos SVG — sem fundo visível na sidebar ──────────────────────────────
  // O ícone (quadrado) fica centralizado no topo do sidebar
  const iconSrc    = '/financeflow-icon-purple-bg.svg';
  const logoSrc    = isDark
    ? '/financeflow-logo-b-dark.svg'
    : '/financeflow-logo-b-light.svg';

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
      {/* ── DESKTOP — Sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40">

        {/* Logo centralizado */}
        <div className="flex flex-col items-center justify-center py-6 px-4 border-b border-sidebar-border gap-2">
          {/* Ícone quadrado */}
          <img
            src={iconSrc}
            alt="FinanceFlow icon"
            className="w-12 h-12 rounded-xl object-cover"
          />
          {/* Nome do app
          <span className="text-sm font-bold tracking-wide text-sidebar-foreground">
            FinanceFlow
          </span> */}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {allTabs.map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
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

      {/* ── MOBILE — Barra inferior ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
        <div className="flex items-center justify-around h-16 px-1 overflow-x-auto gap-1">
          {[...STATIC_TABS, ...moduleTabs, MODULES_TAB].map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors shrink-0',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}

          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            {isDark ? <Sun size={22} strokeWidth={1.8} /> : <Moon size={22} strokeWidth={1.8} />}
            <span className="text-[10px] font-medium">Tema</span>
          </button>

          <LogoutDialog>
            <button className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0">
              <LogOut size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-medium">Sair</span>
            </button>
          </LogoutDialog>
        </div>
      </nav>
    </>
  );
}
