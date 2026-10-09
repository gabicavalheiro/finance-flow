import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FixedExpense, ExpenseCategory, PaymentMethod, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { updateFixedExpense } from '@/lib/store';
import { isFixedAdjusted, withFixedAmountForMonth } from '@/lib/fixedExpenses';
import CategorySelect from '@/components/CategorySelect';
import CurrencyInput from '@/components/CurrencyInput';

interface Props {
  expense: FixedExpense;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Mês em exibição ('YYYY-MM'). Quando informado, permite ajustar o valor só desse mês. */
  month?: string;
}

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function EditFixedExpenseDialog({ expense, open, onClose, onSaved, month }: Props) {
  const [name, setName]             = useState(expense.name);
  const [amount, setAmount]         = useState(String(expense.amount));
  const [monthAmount, setMonthAmt]  = useState('');
  const [category, setCategory]     = useState<ExpenseCategory>(expense.category);
  const [paymentMethod, setPayment] = useState<PaymentMethod>(expense.paymentMethod ?? 'pix');
  const [variable, setVariable]     = useState(!!expense.variable);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    setName(expense.name);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setPayment(expense.paymentMethod ?? 'pix');
    setVariable(!!expense.variable);
    setMonthAmt(month && isFixedAdjusted(expense, month) ? String(expense.amountByMonth![month]) : '');
  }, [expense, month]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const fields: Partial<FixedExpense> = {
      name: name.trim(),
      amount: parsed,
      category,
      paymentMethod,
      variable,
    };

    if (month) {
      const m = parseFloat(monthAmount);
      const adjust = !isNaN(m) && m > 0 ? m : null;   // vazio = volta ao valor padrão
      fields.amountByMonth = withFixedAmountForMonth(expense, month, adjust);
      // Ajustar um mês só faz sentido para gasto que varia
      if (adjust !== null) fields.variable = true;
    }

    setSaving(true);
    try {
      await updateFixedExpense(expense.id, fields);
      toast.success('Gasto fixo atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar gasto fixo');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border rounded-3xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar Gasto Fixo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Aluguel, Netflix..."
              className="bg-secondary border-border"
            />
          </div>

          {/* Valor padrão */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {variable || month ? 'Valor padrão mensal (R$)' : 'Valor (R$)'}
            </Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Ajuste só deste mês */}
          {month && (
            <div className="space-y-1.5 rounded-xl bg-secondary/60 p-3">
              <Label className="text-xs font-medium capitalize">Só em {monthName(month)} (R$)</Label>
              <CurrencyInput value={monthAmount} onChange={setMonthAmt} className="bg-secondary border-border" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Use quando o valor deste mês for diferente do padrão. Deixe vazio para usar o valor padrão.
              </p>
            </div>
          )}

          {/* Categoria + Método */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <CategorySelect
                type="expense"
                value={category}
                onChange={v => setCategory(v as ExpenseCategory)}
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Pagamento</Label>
              <Select value={paymentMethod} onValueChange={v => setPayment(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, { label: string }][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variável */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Valor variável</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Costuma mudar de um mês para o outro</p>
            </div>
            <Switch checked={variable} onCheckedChange={setVariable} aria-label="Valor variável" />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1 text-white"
              style={{ background: 'linear-gradient(135deg, hsl(0 0% 32%), hsl(0 0% 12%))' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
