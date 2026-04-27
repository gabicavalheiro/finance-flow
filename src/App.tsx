// src/App.tsx
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AppNav from "@/components/AppNav";
import QuickAddFAB from "@/components/QuickAddFAB";
import DailyAlertsDialog from "@/components/DailyAlertsDialog";
import Index from "./pages/Index";
import CardsPage from "./pages/CardsPage";
import FixedPage from "./pages/FixedPage";
import ReportsPage from "./pages/ReportsPage";
import FaturaPage from "./pages/FaturaPage";
import AuthPage from "./pages/AuthPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import NotFound from "./pages/NotFound";
import ModulesPage from "./pages/ModulesPage";
import LoansPage from "./pages/LoansPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import GoalsPage from "./pages/GoalsPage";
import { useDeepLink } from '@/hooks/useDeepLink';

const queryClient = new QueryClient();

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="financeflow-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

// Páginas onde o FAB não faz sentido
const FAB_HIDDEN_PATHS = ['/modules'];

function AppRoutes() {
  useDeepLink();
  const location = useLocation();
  const showFAB  = !FAB_HIDDEN_PATHS.includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <AppNav />

      {/* ── Popup de avisos — abre ao entrar em /reports e /faturas ── */}
      <DailyAlertsDialog />

      <main className="flex-1 min-w-0 md:pl-64">
        <Routes>
          <Route path="/"            element={<Index />} />
          <Route path="/cards"       element={<CardsPage />} />
          <Route path="/fixed"       element={<FixedPage />} />
          <Route path="/faturas"     element={<FaturaPage />} />
          <Route path="/reports"     element={<ReportsPage />} />
          <Route path="/modules"     element={<ModulesPage />} />
          <Route path="/goals"       element={<GoalsPage />} />
          <Route path="/loans"       element={<LoansPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="*"            element={<NotFound />} />
        </Routes>
      </main>

      {showFAB && <QuickAddFAB />}
    </div>
  );
}

const App = () => {
  const [session, setSession]                       = useState<Session | null>(null);
  const [loading, setLoading]                       = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else {
        setSession(session);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <Providers>
      <BrowserRouter>
        {isPasswordRecovery ? (
          <Routes>
            <Route path="*" element={<PasswordResetPage onDone={() => {}} />} />
          </Routes>
        ) : !session ? (
          <Routes>
            <Route path="*" element={<AuthPage />} />
          </Routes>
        ) : (
          <AppRoutes />
        )}
      </BrowserRouter>
    </Providers>
  );
};

export default App;