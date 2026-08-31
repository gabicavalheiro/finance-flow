// src/App.tsx — OTIMIZADO: React.lazy + Suspense para code splitting
// Cada página carrega como chunk separado; só baixa quando o usuário navega.

import { useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AppNav from "@/components/AppNav";
import QuickAddFAB from "@/components/QuickAddFAB";
import { useDeepLink } from '@/hooks/useDeepLink';
import { FinanceDataProvider, useFinanceData } from './contexts/FinanceDataContext';

// ── Lazy imports — cada página vira um chunk separado ─────────────────────────
const Index             = lazy(() => import('./pages/Index'));
const CardsPage         = lazy(() => import('./pages/CardsPage'));
const FixedPage         = lazy(() => import('./pages/FixedPage'));
const ReportsPage       = lazy(() => import('./pages/ReportsPage'));
const FaturaPage        = lazy(() => import('./pages/FaturaPage'));
const AuthPage          = lazy(() => import('./pages/AuthPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const NotFound          = lazy(() => import('./pages/NotFound'));
const ModulesPage       = lazy(() => import('./pages/ModulesPage'));
const LoansPage         = lazy(() => import('./pages/LoansPage'));
const InvestmentsPage   = lazy(() => import('./pages/InvestmentsPage'));
const GoalsPage         = lazy(() => import('./pages/GoalsPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));

// ── Fallback mínimo enquanto chunk carrega ────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ── QueryClient configurado — sem refetch automático em foco de janela ────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

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

// Páginas onde o FAB não aparece
const FAB_HIDDEN_PATHS = ['/modules', '/subscriptions'];

function ConnectedFAB() {
  const { refresh } = useFinanceData();
  return <QuickAddFAB onAdded={refresh} />;
}

function AppRoutes() {
  useDeepLink();
  const location = useLocation();
  const showFAB  = !FAB_HIDDEN_PATHS.includes(location.pathname);

  return (
    <FinanceDataProvider>
      <div className="flex min-h-screen bg-background">
        <AppNav />
        <main className="flex-1 min-w-0 md:pl-64">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"              element={<Index />} />
              <Route path="/cards"         element={<CardsPage />} />
              <Route path="/fixed"         element={<FixedPage />} />
              <Route path="/faturas"       element={<FaturaPage />} />
              <Route path="/reports"       element={<ReportsPage />} />
              <Route path="/modules"       element={<ModulesPage />} />
              <Route path="/goals"         element={<GoalsPage />} />
              <Route path="/loans"         element={<LoansPage />} />
              <Route path="/investments"   element={<InvestmentsPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="*"              element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        {showFAB && <ConnectedFAB />}
      </div>
    </FinanceDataProvider>
  );
}

const App = () => {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Link de redefinição de senha do Firebase: .../reset-password?mode=resetPassword&oobCode=...
  // Detectado direto pela URL — funciona esteja o usuário logado ou não,
  // diferente do fluxo antigo do Supabase que usava um evento de sessão.
  const isPasswordReset = new URLSearchParams(window.location.search).get('mode') === 'resetPassword';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return null;

  return (
    <Providers>
      <BrowserRouter>
        {isPasswordReset ? (
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="*" element={<PasswordResetPage onDone={() => { window.location.href = '/'; }} />} />
            </Routes>
          </Suspense>
        ) : !user ? (
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="*" element={<AuthPage />} />
            </Routes>
          </Suspense>
        ) : (
          <AppRoutes />
        )}
      </BrowserRouter>
    </Providers>
  );
};

export default App;