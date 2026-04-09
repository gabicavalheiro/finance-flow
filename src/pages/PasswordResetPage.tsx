import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, TrendingUp, ArrowRight, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/lib/auth';
import { toast } from 'sonner';

interface Props {
  onDone: () => void;
}

export default function PasswordResetPage({ onDone }: Props) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async () => {
    if (!password) { toast.error('Informe a nova senha'); return; }
    if (password.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return; }

    setLoading(true);
    const { ok, error } = await updatePassword(password);
    setLoading(false);

    if (!ok) { toast.error(error ?? 'Erro ao redefinir senha'); return; }

    toast.success('Senha redefinida com sucesso!');
    onDone();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, hsl(263 70% 58% / 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 35% at 80% 90%, hsl(220 70% 55% / 0.10) 0%, transparent 70%)
          `,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}>
            <TrendingUp size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FinanceFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Redefinir senha</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="text-center mb-2">
            <h2 className="text-base font-semibold">Criar nova senha</h2>
            <p className="text-xs text-muted-foreground mt-1">Escolha uma senha segura para sua conta</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-secondary border-border pl-9 pr-10"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Confirmar senha</Label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-secondary border-border pl-9"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-11 rounded-xl font-semibold text-sm mt-2 gap-2"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Aguarde...
              </span>
            ) : (
              <>Salvar nova senha <ArrowRight size={16} /></>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
