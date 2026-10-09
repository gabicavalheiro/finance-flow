import { safeHttpUrl } from '@/lib/safeUrl';
import { useState, useEffect } from 'react';
import { Loader2, CreditCard as CreditCardIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/helpers';
import { Subscription, SUBSCRIPTION_CATEGORIES, BillingCycle, addSubscription, updateSubscription } from '@/lib/subscriptions';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput';
import { POPULAR_ICONS, FormState, EMPTY_FORM } from '@/features/subscriptions/constants';

export interface FormDialogProps {
  open:     boolean;
  editing?: Subscription;
  /** Pré-preenche o formulário de uma nova assinatura (ex: a partir de um lançamento identificado) */
  prefill?: Partial<FormState>;
  onClose:  () => void;
  onSaved:  () => void;
}

export function FormDialog({ open, editing, prefill, onClose, onSaved }: FormDialogProps) {
  const { cards } = useFinanceData();
  const [form,   setForm]   = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        name:         editing.name,
        amount:       editing.amount,
        billingCycle: editing.billingCycle,
        billingDay:   editing.billingDay,
        category:     editing.category,
        icon:         editing.icon ?? '📦',
        url:          editing.url ?? '',
        notes:        editing.notes ?? '',
        cardId:       editing.cardId ?? '',
      } : { ...EMPTY_FORM, ...prefill });
    }
  }, [open, editing, prefill]);

  // Função nomeada — evita ambiguidade <K extends> com JSX em .tsx
  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    if (form.amount <= 0)  { toast.error('Valor deve ser maior que zero'); return; }
    setSaving(true);
    try {
      const sub: Subscription = {
        id:           editing?.id ?? generateId(),
        name:         form.name.trim(),
        amount:       form.amount,
        billingCycle: form.billingCycle,
        billingDay:   form.billingDay,
        category:     form.category,
        active:       editing?.active ?? true,
        paidMonths:   editing?.paidMonths ?? [],
        cardId:       form.cardId || undefined,
        icon:         form.icon  || undefined,
        url:          safeHttpUrl(form.url) ?? undefined,
        notes:        form.notes.trim() || undefined,
      };
      if (editing) {
        await updateSubscription(sub);
        toast.success('Assinatura atualizada!');
      } else {
        await addSubscription(sub);
        toast.success('Assinatura adicionada!');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Erro ao salvar assinatura');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? 'Editar assinatura' : 'Nova assinatura'}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Ícone */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Ícone</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setField('icon', ic)}
                  className={cn(
                    'w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border',
                    form.icon === ic
                      ? 'bg-primary/20 border-primary'
                      : 'bg-secondary border-transparent hover:bg-primary/10',
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Ex: Netflix, Spotify..."
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput
              value={form.amount > 0 ? String(form.amount) : ''}
              onChange={raw => setField('amount', raw ? parseFloat(raw) : 0)}
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Ciclo + Dia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ciclo</Label>
              <Select
                value={form.billingCycle}
                onValueChange={v => setField('billingCycle', v as BillingCycle)}
              >
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia da cobrança</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.billingDay}
                onChange={e => setField('billingDay', Math.max(1, Math.min(31, Number(e.target.value))))}
                className="bg-secondary border-border rounded-xl h-11"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={form.category} onValueChange={v => setField('category', v)}>
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cartão */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cartão de cobrança</Label>
            <Select
              value={form.cardId || 'none'}
              onValueChange={v => setField('cardId', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Nenhum (débito / PIX)</span>
                </SelectItem>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CreditCardIcon size={13} />
                      {c.name} •••• {c.lastDigits}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Site (opcional)</Label>
            <Input
              value={form.url}
              onChange={e => setField('url', e.target.value)}
              placeholder="https://netflix.com"
              type="url"
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
            <Input
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Compartilhado com a família..."
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SubCard ──────────────────────────────────────────────────────────────────
