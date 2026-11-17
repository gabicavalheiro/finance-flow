// "Tornar uma meta" — transforma a compra numa meta de economia, com um plano explicado
// passo a passo, e salva no módulo de Metas.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PiggyBank, CalendarCheck, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addGoal, type Goal } from '@/lib/goals';
import { addMonths, formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { GOAL_COLORS, GOAL_EMOJIS } from '@/features/goals/constants';
import type { GoalPlan } from './plan';

const DEADLINES = [3, 6, 12, 18, 24];

const monthYear = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export function MakeGoalDialog({ open, onOpenChange, item, price, plan }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: string;
  price: number;
  plan: GoalPlan;
}) {
  const navigate = useNavigate();
  const [name, setName]     = useState(item);
  const [emoji, setEmoji]   = useState('🛍️');
  const [months, setMonths] = useState(plan.months);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (open) { setName(item); setMonths(plan.months); setSaved(false); }
  }, [open, item, plan.months]);

  const options = useMemo(
    () => [...new Set([plan.months, ...DEADLINES])].sort((a, b) => a - b),
    [plan.months],
  );

  const monthly = price / months;
  // Prazo igual ou maior que o sugerido = dá para cumprir com a sobra prevista
  const fits = plan.feasible && months >= plan.months;
  const doneMonth = monthYear(addMonths(getCurrentMonth(), months));

  const save = async () => {
    if (!name.trim()) { toast.error('Dê um nome para a meta'); return; }
    setSaving(true);
    try {
      const goal: Goal = {
        id: crypto.randomUUID(),
        name: name.trim(),
        emoji,
        targetAmount: price,
        currentSaved: 0,
        monthsDeadline: months,
        startDate: new Date().toISOString().slice(0, 10),
        color: GOAL_COLORS[0].value,
        priority: 2,
        createdAt: new Date().toISOString(),
      };
      await addGoal(goal);
      setSaved(true);
      toast.success('Meta criada!');
    } catch {
      toast.error('Não consegui criar a meta. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tornar uma meta</DialogTitle>
          <DialogDescription>
            Em vez de comprar agora, você junta o dinheiro aos poucos e compra à vista, sem apertar o mês.
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="space-y-4 text-center py-2">
            <p className="text-4xl" aria-hidden>{emoji}</p>
            <p className="text-sm leading-relaxed">
              Meta <strong>{name}</strong> criada! Guarde <strong>{formatCurrency(monthly)}</strong> por mês
              e registre cada valor em Metas para acompanhar o progresso.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button className="flex-1" onClick={() => navigate('/goals')}>Ver em Metas</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="mg-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome da meta</label>
              <div className="flex gap-2">
                <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0" aria-hidden>{emoji}</span>
                <Input id="mg-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Tênis novo" maxLength={40} />
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {GOAL_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setEmoji(e)} aria-label={`Ícone ${e}`}
                    className={cn('w-8 h-8 rounded-lg text-base transition-colors', emoji === e ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-muted')}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Em quanto tempo?</p>
              <div className="flex flex-wrap gap-2">
                {options.map(n => (
                  <button key={n} type="button" onClick={() => setMonths(n)} aria-pressed={months === n}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full border transition-colors',
                      months === n ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted',
                    )}>
                    {n} {n === 1 ? 'mês' : 'meses'}{n === plan.months && plan.feasible ? ' · sugerido' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* O plano, explicado */}
            <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seu plano</p>

              <div className="flex items-start gap-2.5">
                <PiggyBank size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-sm leading-relaxed">
                  Guarde <strong>{formatCurrency(monthly)}</strong> por mês, durante {months} {months === 1 ? 'mês' : 'meses'}.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CalendarCheck size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-sm leading-relaxed">
                  Em <strong className="capitalize">{doneMonth}</strong> você terá {formatCurrency(price)} para comprar à vista, sem juros.
                </p>
              </div>

              <div className={cn('rounded-lg px-3 py-2 text-xs leading-relaxed', fits ? 'bg-success/10' : 'bg-warning/10')}>
                {plan.available > 0 ? (
                  <>
                    Olhando mês a mês o que sobra depois das contas, da reserva de segurança e das suas outras metas,
                    você junta esse valor em <strong>{plan.months} {plan.months === 1 ? 'mês' : 'meses'}</strong>
                    {plan.feasible ? '' : ' ou mais'}.{' '}
                    {fits
                      ? <>Com o prazo escolhido, dá para cumprir.</>
                      : <>Com um prazo mais curto, você vai precisar guardar além do que costuma sobrar — corte algum gasto ou aumente o prazo.</>}
                  </>
                ) : (
                  <>
                    Hoje, depois das contas e da reserva de segurança, não está sobrando dinheiro no mês.
                    Para essa meta andar, você vai precisar liberar {formatCurrency(monthly)} por mês — por exemplo,
                    revisando assinaturas e gastos do dia a dia.
                  </>
                )}
              </div>

              <div className="flex items-start gap-2.5">
                <ListChecks size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <ul className="text-xs text-muted-foreground leading-relaxed space-y-1">
                  <li>Separe o valor assim que receber, antes de gastar com o resto.</li>
                  <li>Registre cada depósito em Metas — o app mostra se você está no ritmo.</li>
                  <li>Se o preço baixar ou você juntar mais rápido, é só comprar antes.</li>
                </ul>
              </div>
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : 'Criar meta'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
