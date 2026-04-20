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
import AuthPage from "./pages/AuthPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import NotFound from "./pages/NotFound";

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
      } else if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <Providers>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Providers>
    );
  }

  if (isPasswordRecovery) {
    return (
      <Providers>
        <PasswordResetPage onDone={() => setIsPasswordRecovery(false)} />
      </Providers>
    );
  }

  if (!session) {
    return (
      <Providers>
        <AuthPage />
      </Providers>
    );
  }

  return (
    <Providers>
      <BrowserRouter>
        <div className="flex min-h-screen bg-background">
          <AppNav />
          <main className="flex-1 min-w-0 md:pl-64">
            <Routes>
              <Route path="/"        element={<Index />} />
              <Route path="/cards"   element={<CardsPage />} />
              <Route path="/fixed"   element={<FixedPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*"        element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Providers>
  );
};

export default App;