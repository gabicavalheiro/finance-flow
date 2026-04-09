import { LayoutDashboard, CreditCard, CalendarCheck, BarChart3, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
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

export default function BottomNav() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserName(user?.user_metadata?.name ?? '');
    });
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    // App.tsx detecta via onAuthStateChange
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <LogOut size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-medium">Sair</span>
            </button>
          </AlertDialogTrigger>
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
      </div>
    </nav>
  );
}