import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
  onDone: () => void;
}

export default function PasswordResetPage({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Senha atualizada com sucesso');
    onDone();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-primary" />
          <h1 className="text-lg font-semibold">Redefinir senha</h1>
        </div>

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
  );
}
