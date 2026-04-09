import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, TrendingUp, ArrowRight, User, Mail, Lock, KeyRound, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { loginUser, registerUser, sendPasswordReset } from '@/lib/auth';
import { toast } from 'sonner';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setConfirm('');
    setForgotSent(false);
  };

  const handleSubmit = async () => {
    if (!email || !password) { toast.error('Preencha todos os campos'); return; }
    setLoading(true);

    if (mode === 'register') {
      if (!name.trim()) { toast.error('Informe seu nome'); setLoading(false); return; }
      if (password.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); setLoading(false); return; }
      if (password !== confirm) { toast.error('As senhas não coincidem'); setLoading(false); return; }

      const { ok, error } = await registerUser(name.trim(), email, password);
      if (!ok) {
        toast.error(error ?? 'Erro ao criar conta');
        setLoading(false);
        return;
      }
      // Auto-login após registro
      const login = await loginUser(email, password);
      if (!login.ok) {
        toast.success('Conta criada! Faça login.');
        setMode('login');
      }
      // Se login ok, App.tsx detecta via onAuthStateChange
    } else {
      const { ok, error } = await loginUser(email, password);
      if (!ok) {
        toast.error('E-mail ou senha incorretos');
        setLoading(false);
        return;
      }
      // App.tsx detecta via onAuthStateChange
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { toast.error('Informe seu e-mail'); return; }
    setLoading(true);
    const { ok, error } = await sendPasswordReset(email);
    setLoading(false);
    if (!ok) { toast.error(error ?? 'Erro ao enviar e-mail'); return; }
    setForgotSent(true);
  };

  const spinnerSVG = (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      Aguarde...
    </span>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, hsl(263 70% 58% / 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 35% at 80% 90%, hsl(220 70% 55% / 0.10) 0%, transparent 70%)
          `,
        }}
      />
      <div className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{ top: '-4rem', right: '-4rem', background: 'radial-gradient(circle, hsl(263 70% 58% / 0.08), transparent 70%)' }} />
      <div className="absolute w-48 h-48 rounded-full pointer-events-none"
        style={{ bottom: '4rem', left: '-3rem', background: 'radial-gradient(circle, hsl(220 70% 55% / 0.08), transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            <TrendingUp size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FinanceFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Seu gestor financeiro inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xl">

          {/* Tabs login/register */}
          {mode !== 'forgot' && (
            <div className="flex bg-secondary rounded-xl p-1 mb-6">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { reset(); setMode(m); }}
                  className="flex-1 text-sm font-medium py-2 rounded-lg transition-all duration-200"
                  style={{
                    background: mode === m ? 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' : 'transparent',
                    color: mode === m ? '#fff' : 'hsl(240 5% 55%)',
                  }}
                >
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>
          )}

          {/* Header forgot */}
          {mode === 'forgot' && (
            <div className="mb-6 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}>
                <KeyRound size={18} className="text-white" />
              </div>
              <h2 className="text-base font-semibold">Esqueci minha senha</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {forgotSent ? 'Verifique sua caixa de entrada' : 'Informe seu e-mail para receber o link de redefinição'}
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={mode + String(forgotSent)}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* ── LOGIN / REGISTER ── */}
              {mode !== 'forgot' && (
                <>
                  {mode === 'register' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nome completo</Label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"
                          className="bg-secondary border-border pl-9" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">E-mail</Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                        className="bg-secondary border-border pl-9" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Senha</Label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                        className="bg-secondary border-border pl-9 pr-10" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Confirmar senha</Label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                          placeholder="Repita a senha" className="bg-secondary border-border pl-9"
                          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSubmit} disabled={loading} className="w-full h-11 rounded-xl font-semibold text-sm mt-2 gap-2"
                    style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}>
                    {loading ? spinnerSVG : <>{mode === 'login' ? 'Entrar' : 'Criar conta'}<ArrowRight size={16} /></>}
                  </Button>

                  {mode === 'login' && (
                    <button type="button" onClick={() => { reset(); setMode('forgot'); }}
                      className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors">
                      Esqueci minha senha
                    </button>
                  )}
                </>
              )}

              {/* ── FORGOT PASSWORD ── */}
              {mode === 'forgot' && !forgotSent && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">E-mail cadastrado</Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                        className="bg-secondary border-border pl-9" onKeyDown={e => e.key === 'Enter' && handleForgot()} />
                    </div>
                  </div>

                  <Button onClick={handleForgot} disabled={loading} className="w-full h-11 rounded-xl font-semibold text-sm mt-2 gap-2"
                    style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}>
                    {loading ? spinnerSVG : <>Enviar link de redefinição<Send size={15} /></>}
                  </Button>
                </>
              )}

              {mode === 'forgot' && forgotSent && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-success/15 flex items-center justify-center mx-auto">
                    <Send size={20} className="text-success" style={{ color: 'hsl(152 69% 45%)' }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enviamos um link para <span className="text-foreground font-medium">{email}</span>. Clique nele para definir uma nova senha.
                  </p>
                  <p className="text-xs text-muted-foreground">Não recebeu? Verifique sua pasta de spam.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === 'forgot' ? (
            <>
              Lembrou a senha?{' '}
              <button onClick={() => { reset(); setMode('login'); }} className="text-primary hover:underline font-medium">
                Fazer login
              </button>
            </>
          ) : mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button onClick={() => { reset(); setMode('register'); }} className="text-primary hover:underline font-medium">
                Criar agora
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button onClick={() => { reset(); setMode('login'); }} className="text-primary hover:underline font-medium">
                Fazer login
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}