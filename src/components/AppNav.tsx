import { LayoutDashboard, CreditCard, CalendarCheck, BarChart3, LogOut, Sun, Moon, TrendingUp } from 'lucide-react';
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

const tabs = [
  { path: '/',        label: 'Início',     icon: LayoutDashboard },
  { path: '/cards',   label: 'Cartões',    icon: CreditCard      },
  { path: '/fixed',   label: 'Fixos',      icon: CalendarCheck   },
  { path: '/reports', label: 'Relatórios', icon: BarChart3       },
];

export default function AppNav() {
  const location             = useLocation();
  const navigate             = useNavigate();
  const { theme, setTheme }  = useTheme();
  const [userName, setUserName] = useState('');
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserName(user?.user_metadata?.name ?? '');
    });
  }, []);

  const handleLogout = async () => { await logoutUser(); };
  const toggleTheme  = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Evita hydration mismatch no ícone de tema
  const isDark = mounted ? theme === 'dark' : true;

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
          <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
            Sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      {/* ────────────────────────────────────────────────────────────
          DESKTOP — Sidebar fixa à esquerda (visível em md+)
      ──────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar border-r border-sidebar-border z-40">

        {/* Logo / cabeçalho */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            <TrendingUp size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-none">FinanceFlow</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {userName || 'Bem-vindo'}
            </p>
          </div>
        </div>

        {/* Itens de navegação */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {tabs.map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  active
                    ? 'text-white shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
                style={active ? { background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' } : undefined}
              >
                <tab.icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Rodapé: toggle de tema + sair */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            {isDark
              ? <Sun size={18} strokeWidth={1.8} />
              : <Moon size={18} strokeWidth={1.8} />
            }
            {isDark ? 'Modo claro' : 'Modo escuro'}
          </button>

          <LogoutDialog>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
              <LogOut size={18} strokeWidth={1.8} />
              Sair
            </button>
          </LogoutDialog>
        </div>
      </aside>

      {/* ────────────────────────────────────────────────────────────
          MOBILE — Barra inferior (visível apenas abaixo de md)
      ──────────────────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs.map(tab => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* Toggle de tema no mobile */}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            {isDark
              ? <Sun size={22} strokeWidth={1.8} />
              : <Moon size={22} strokeWidth={1.8} />
            }
            <span className="text-[10px] font-medium">Tema</span>
          </button>

          {/* Logout no mobile */}
          <LogoutDialog>
            <button className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <LogOut size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-medium">Sair</span>
            </button>
          </LogoutDialog>
        </div>
      </nav>
    </>
  );
}
