import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AppNav from "@/components/AppNav";
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

const AppRoutes = () => {
  useDeepLink();

  return (
    <div className="flex min-h-screen bg-background">
      <AppNav />
      <main className="flex-1 min-w-0 md:pl-64">
        <Routes>
          {/* ── Rotas fixas ── */}
          <Route path="/"        element={<Index />} />
          <Route path="/cards"   element={<CardsPage />} />
          <Route path="/fixed"   element={<FixedPage />} />
          <Route path="/faturas" element={<FaturaPage />} />
          <Route path="/reports" element={<ReportsPage />} />

          {/* ── Gerenciamento de módulos ── */}
          <Route path="/modules" element={<ModulesPage />} />

          {/* ── Módulos opcionais (rotas sempre ativas; aba aparece só se módulo ativo) ── */}
          <Route path="/loans"       element={<LoansPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

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
          <Routes><Route path="*" element={<PasswordResetPage onDone={function (): void {
            throw new Error('Function not implemented.');
          } } />} /></Routes>
        ) : !session ? (
          <Routes><Route path="*" element={<AuthPage />} /></Routes>
        ) : (
          <AppRoutes />
        )}
      </BrowserRouter>
    </Providers>
  );
};

export default App;
