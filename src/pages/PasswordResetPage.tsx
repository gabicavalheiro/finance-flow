import { useState } from 'react';
import { Lock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { confirmPasswordResetWithCode } from '@/lib/auth';

interface Props {
  onDone: () => void;
}

export default function PasswordResetPage({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  // O Firebase manda o código de confirmação na própria URL do e-mail:
  // .../reset-password?mode=resetPassword&oobCode=xxxxx
  const oobCode = new URLSearchParams(window.location.search).get('oobCode');

  const handleSubmit = async () => {
    if (!oobCode) {
      toast.error('Link inválido ou expirado — solicite um novo');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSaving(true);
    const { ok, error } = await confirmPasswordResetWithCode(oobCode, password);
    setSaving(false);

    if (!ok) {
      toast.error(error ?? 'Erro ao atualizar senha');
      return;
    }

    toast.success('Senha atualizada com sucesso — faça login novamente');
    onDone();
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            <TrendingUp size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FinanceFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Redefinir senha</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Confirmar senha</Label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pl-9"
              placeholder="Repita a senha"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
        </div>
      </div>
    </div>
  );
}
