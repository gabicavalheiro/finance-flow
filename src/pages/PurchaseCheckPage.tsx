// src/pages/PurchaseCheckPage.tsx — "Posso comprar?"
// A pessoa diz o que quer comprar, o valor e a forma de pagamento; o app olha o orçamento
// dos meses afetados e responde: pode ir, cabe com custo ou não recomendo agora.

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Lightbulb, RotateCcw, Brain, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CurrencyInput from '@/components/CurrencyInput';
import CategorySelect from '@/components/CategorySelect';
import { LoadingState } from '@/components/states/StateViews';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { getVariableTransactions, getInvoicesForMonthRange, type CardInvoice } from '@/lib/store';
import { getGoals, computeGoalStats, type Goal } from '@/lib/goals';
import { getBudgets, type Budget } from '@/lib/budgets';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { addMonths, formatCurrency, getCurrentMonth } from '@/lib/helpers';
import type { VariableTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSpendingForecast } from '@/features/forecast/useSpendingForecast';
import { buildPurchaseSnapshots } from '@/features/purchase-check/buildSnapshots';
import {
  evaluatePurchase, suggestInstallments, DEFAULT_RESERVE_RATIO,
  type MonthImpact, type PurchaseEvaluation, type PurchaseVerdict,
} from '@/features/purchase-check/evaluate';
import { planPurchaseGoal } from '@/features/purchase-check/plan';
import { MakeGoalDialog } from '@/features/purchase-check/MakeGoalDialog';

const HORIZON = 12;
const QUICK_VALUES = [100, 500, 1000, 3000];
const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

const VERDICT_UI: Record<PurchaseVerdict, {
  title: string; meaning: string; icon: typeof CheckCircle2; box: string; iconCls: string;
}> = {
  go: {
    title: 'Pode ir', meaning: 'Depois da compra ainda sobra dinheiro para imprevistos e para as suas metas.',
    icon: CheckCircle2, box: 'bg-success/10 border-success/30', iconCls: 'text-success',
  },
  cost: {
    title: 'Cabe, mas com custo', meaning: 'Dá para pagar, mas vai sobrar pouco para imprevistos, metas ou para a categoria.',
    icon: AlertTriangle, box: 'bg-warning/10 border-warning/30', iconCls: 'text-warning',
  },
  no: {
    title: 'Não recomendo agora', meaning: 'Essa compra deixaria o mês no vermelho: você gastaria mais do que ganha.',
    icon: XCircle, box: 'bg-destructive/10 border-destructive/30', iconCls: 'text-destructive',
  },
  unknown: {
    title: 'Não consigo avaliar', meaning: 'Faltam informações para eu fazer a conta.',
    icon: HelpCircle, box: 'bg-muted border-border', iconCls: 'text-muted-foreground',
  },
};

const VERDICT_RANK: Record<PurchaseVerdict, number> = { go: 0, cost: 1, no: 2, unknown: -1 };

interface HabitWarning { verdict: PurchaseVerdict; extra: number }

const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
};

export default function PurchaseCheckPage() {
  const { cards, expenses, fixedExpenses, incomes, subscriptions, loading } = useFinanceData();
  const currentMonth = getCurrentMonth();

  // ── Dados extras do mês atual ────────────────────────────────────────────
  const [varAll, setVarAll]     = useState<VariableTransaction[]>([]);
  const [invoicesByMonth, setInvoicesByMonth] = useState<Record<string, CardInvoice[]>>({});
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [budgets, setBudgets]   = useState<Budget[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const months = Array.from({ length: HORIZON }, (_, i) => addMonths(currentMonth, i));
    Promise.all([
      getVariableTransactions(),
      getInvoicesForMonthRange(months),
      getGoals().catch(() => [] as Goal[]),
      getBudgets(),
    ]).then(([v, inv, g, b]) => {
      if (!alive) return;
      setVarAll(v); setInvoicesByMonth(inv); setGoals(g); setBudgets(b);
    }).finally(() => { if (alive) setExtraLoading(false); });
    return () => { alive = false; };
  }, [currentMonth]);

  // Gasto variável previsto pelo modelo de ML (mesmo da aba Previsão)
  const { forecast } = useSpendingForecast({ expenses, cards, currentMonth });

  const varTxsByMonth = useMemo(() => {
    const by: Record<string, VariableTransaction[]> = {};
    for (const t of varAll) (by[t.date.slice(0, 7)] ??= []).push(t);
    return by;
  }, [varAll]);

  const snapshots = useMemo(() => buildPurchaseSnapshots({
    currentMonth, horizon: HORIZON,
    cards, expenses, fixedExpenses, incomes, subscriptions, varTxsByMonth, invoicesByMonth,
    forecast: forecast?.total ?? [],
  }), [currentMonth, cards, expenses, fixedExpenses, incomes, subscriptions, varTxsByMonth, invoicesByMonth, forecast]);

  // Quanto por mês vai para metas ativas
  const goalsMonthly = useMemo(() => {
    const free = snapshots.months[0] ? Math.max(0, snapshots.months[0].income - snapshots.months[0].expense) : 0;
    return goals
      .filter(g => (g.currentSaved ?? 0) < g.targetAmount)
      .reduce((s, g) => s + computeGoalStats(g, free).monthlySavingsNeeded, 0);
  }, [goals, snapshots]);

  // ── Formulário ───────────────────────────────────────────────────────────
  const [item, setItem]         = useState('');
  const [rawValue, setRawValue] = useState('');
  const [installments, setInstallments] = useState(1);
  const [category, setCategory] = useState('shopping');
  const [result, setResult]     = useState<{
    item: string; price: number; installments: number; evaluation: PurchaseEvaluation;
    suggestion: ReturnType<typeof suggestInstallments>;
    habit: HabitWarning | null;
  } | null>(null);

  const price = parseFloat(rawValue.replace(',', '.')) || 0;

  const ask = () => {
    const budget = budgets.find(b => b.category === category);
    const input = {
      price, installments,
      months: snapshots.months,
      goalsMonthly,
      categoryBudget: budget ? {
        label: resolveCategoryInfo(category).label,
        limit: budget.amount,
        spent: snapshots.spentByCategory[category] ?? 0,
      } : undefined,
    };
    const evaluation = evaluatePurchase(input);
    const suggestion = evaluation.verdict === 'no' ? suggestInstallments(input) : null;

    // Aviso extra: e se você gastar no dia a dia como de costume (previsão de ML)?
    let habit: HabitWarning | null = null;
    const extra = snapshots.extraByMonth.slice(0, installments);
    const extraMax = Math.max(0, ...extra);
    if (evaluation.verdict !== 'no' && evaluation.verdict !== 'unknown' && extraMax > 0) {
      const withHabit = evaluatePurchase({
        ...input,
        months: snapshots.months.map((m, i) => ({ ...m, expense: m.expense + (snapshots.extraByMonth[i] ?? 0) })),
      });
      if (VERDICT_RANK[withHabit.verdict] > VERDICT_RANK[evaluation.verdict]) {
        habit = { verdict: withHabit.verdict, extra: extraMax };
      }
    }
    setResult({ item: item.trim(), price, installments, evaluation, suggestion, habit });
  };

  const reset = () => { setResult(null); setItem(''); setRawValue(''); setInstallments(1); };

  // ── Tornar uma meta ─────────────────────────────────────────────────────
  const [goalOpen, setGoalOpen] = useState(false);
  const goalPlan = useMemo(
    () => planPurchaseGoal({ price: result?.price ?? 0, months: snapshots.months, goalsMonthly }),
    [result?.price, snapshots.months, goalsMonthly],
  );

  const isLoading = loading || extraLoading;
  const freeNow = snapshots.months[0] ? snapshots.months[0].income - snapshots.months[0].expense : 0;

  return (
    <div className="pb-24 md:pb-10 max-w-2xl mx-auto">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Posso comprar?</h1>
            <p className="text-xs text-muted-foreground">Pergunte antes de comprar — eu olho o seu orçamento</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 space-y-4">
        {isLoading ? (
          <LoadingState rows={2} label="Carregando seu orçamento…" />
        ) : (
          <>
            {/* Sobra do mês */}
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Saldo do mês</p>
                <p className={cn('text-lg font-bold', freeNow < 0 && 'text-destructive')}>{formatCurrency(freeNow)}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">mesmo valor do Início</span>
            </div>

            {/* Formulário */}
            <form
              className="bg-card rounded-2xl border border-border p-4 space-y-4"
              onSubmit={e => { e.preventDefault(); if (price > 0) ask(); }}
            >
              <div className="space-y-1.5">
                <label htmlFor="pc-item" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  O que você quer comprar?
                </label>
                <Input id="pc-item" placeholder="Ex.: tênis novo, celular, viagem…" value={item}
                  onChange={e => setItem(e.target.value)} maxLength={60} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quanto custa?</p>
                <CurrencyInput value={rawValue} onChange={setRawValue} placeholder="0,00" />
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_VALUES.map(v => (
                    <button key={v} type="button" onClick={() => setRawValue(v.toFixed(2))}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors">
                      {formatCurrency(v).replace(',00', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Como vai pagar?</p>
                <div className="flex flex-wrap gap-2">
                  {INSTALLMENT_OPTIONS.map(n => (
                    <button key={n} type="button" onClick={() => setInstallments(n)}
                      aria-pressed={installments === n}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        installments === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted',
                      )}>
                      {n === 1 ? 'À vista' : `${n}x`}
                    </button>
                  ))}
                </div>
                {installments > 1 && price > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {installments}x de {formatCurrency(price / installments)} (sem juros)
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</p>
                <CategorySelect type="expense" value={category} onChange={setCategory} />
              </div>

              <Button type="submit" className="w-full" disabled={!(price > 0)}>
                Posso comprar?
              </Button>
            </form>

            {/* Resposta */}
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key={`${result.price}-${result.installments}-${result.item}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <ResultCard {...result} />
                  {result.evaluation.verdict !== 'unknown' && (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Target size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                        <p className="text-sm leading-relaxed">
                          {result.evaluation.verdict === 'go'
                            ? 'Prefere não mexer na sobra do mês? Você pode juntar o valor aos poucos e comprar à vista.'
                            : 'Que tal transformar essa compra numa meta? Você junta o valor aos poucos e compra à vista, sem apertar o mês.'}
                          {goalPlan.feasible && (
                            <> Pela sua sobra, dá para juntar em <strong>{goalPlan.months} {goalPlan.months === 1 ? 'mês' : 'meses'}</strong>.</>
                          )}
                        </p>
                      </div>
                      <Button
                        className="w-full gap-1.5"
                        variant={result.evaluation.verdict === 'go' ? 'outline' : 'default'}
                        onClick={() => setGoalOpen(true)}
                      >
                        <Target size={14} aria-hidden /> Tornar uma meta
                      </Button>
                    </div>
                  )}
                  <Button variant="outline" className="w-full gap-1.5" onClick={reset}>
                    <RotateCcw size={14} aria-hidden /> Perguntar de novo
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {result && (
              <MakeGoalDialog
                open={goalOpen}
                onOpenChange={setGoalOpen}
                item={result.item || 'Minha compra'}
                price={result.price}
                plan={goalPlan}
              />
            )}

            {/* Como eu decido */}
            <details className="rounded-2xl border border-border bg-card px-4 py-3 group">
              <summary className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none">
                Como eu decido?
              </summary>
              <div className="pt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Para cada mês em que a compra cai, faço a mesma conta do Início:{' '}
                  <strong className="text-foreground">ganhos − gastos = sobra</strong>. Entram salário e outros ganhos, gastos fixos,
                  parcelas de cartão, assinaturas e o que você já lançou no mês. Depois tiro o valor da compra (ou da parcela).
                </p>
                <p>
                  Também deixo uma <strong className="text-foreground">reserva de segurança</strong> de {Math.round(DEFAULT_RESERVE_RATIO * 100)}%
                  do que você ganha, para imprevistos{goalsMonthly > 0 ? <>, mais <strong className="text-foreground">{formatCurrency(goalsMonthly)}</strong> por mês que vão para as suas metas</> : ''}.
                </p>
                <ul className="space-y-1.5">
                  {(['go', 'cost', 'no'] as const).map(v => {
                    const Icon = VERDICT_UI[v].icon;
                    return (
                      <li key={v} className="flex items-start gap-2">
                        <Icon size={14} className={cn('mt-0.5 shrink-0', VERDICT_UI[v].iconCls)} aria-hidden />
                        <span><strong className="text-foreground">{VERDICT_UI[v].title}:</strong> {VERDICT_UI[v].meaning}</span>
                      </li>
                    );
                  })}
                </ul>
                <p>É uma orientação para te ajudar a pensar antes de comprar, não uma regra.</p>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCard({ item, price, installments, evaluation, suggestion, habit }: {
  item: string; price: number; installments: number; evaluation: PurchaseEvaluation;
  suggestion: ReturnType<typeof suggestInstallments>; habit: HabitWarning | null;
}) {
  const ui = VERDICT_UI[evaluation.verdict];
  const Icon = ui.icon;
  const worst = evaluation.worst;

  return (
    <div role="status" aria-live="polite" className={cn('rounded-2xl border p-4 space-y-3', ui.box)}>
      <div className="flex items-start gap-3">
        <Icon size={28} className={cn('shrink-0', ui.iconCls)} aria-hidden />
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{ui.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item ? <><strong className="text-foreground">{item}</strong> · </> : null}
            {formatCurrency(price)}{installments > 1 ? ` em ${installments}x de ${formatCurrency(evaluation.installmentValue)}` : ' à vista'}
          </p>
          <p className="text-sm mt-1.5 leading-relaxed">{ui.meaning}</p>
        </div>
      </div>

      {worst && <MonthMath impact={worst} installments={installments} />}

      {evaluation.reasons.length > 0 && (
        <ul className="space-y-1.5 list-disc pl-5 marker:text-muted-foreground">
          {evaluation.reasons.map((r, i) => (
            <li key={i} className="text-sm leading-relaxed">{r}</li>
          ))}
        </ul>
      )}

      {suggestion && (
        <div className="flex items-start gap-2 rounded-xl bg-background/60 border border-border px-3 py-2.5">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed">
            Se der para parcelar <strong>sem juros em {suggestion.installments}x</strong> ({formatCurrency(price / suggestion.installments)}/mês),
            {suggestion.verdict === 'go' ? ' cabe com folga.' : ' cabe, mas fica apertado.'}
          </p>
        </div>
      )}

      {habit && (
        <div className="flex items-start gap-2 rounded-xl bg-background/60 border border-border px-3 py-2.5">
          <Brain size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed">
            Pelo seu histórico, você costuma gastar até <strong>{formatCurrency(habit.extra)}</strong> por mês em compras do
            dia a dia que ainda não estão lançadas. Se isso se repetir, a resposta seria{' '}
            <strong>{VERDICT_UI[habit.verdict].title.toLowerCase()}</strong>.
          </p>
        </div>
      )}

      {evaluation.impacts.length > 1 && (
        <div className="rounded-xl bg-background/60 border border-border overflow-hidden">
          <p className="px-3 pt-2.5 text-[11px] text-muted-foreground">Mês a mês, enquanto você paga as parcelas:</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Mês</th>
                <th className="text-right font-medium px-3 py-2">Sem a compra</th>
                <th className="text-right font-medium px-3 py-2">Com a compra</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.impacts.map(m => (
                <tr key={m.month} className="border-t border-border">
                  <td className="px-3 py-1.5 capitalize">{monthShort(m.month)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(m.freeBefore)}</td>
                  <td className={cn(
                    'px-3 py-1.5 text-right tabular-nums font-semibold',
                    m.status === 'negative' && 'text-destructive',
                    m.status === 'tight' && 'text-warning',
                  )}>
                    {formatCurrency(m.freeAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A conta do mês mais apertado, linha a linha — para ficar claro de onde vem a resposta. */
function MonthMath({ impact, installments }: { impact: MonthImpact; installments: number }) {
  const [y, m] = impact.month.split('-').map(Number);
  const name = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long' });
  const Row = ({ label, value, strong, cls }: { label: string; value: number; strong?: boolean; cls?: string }) => (
    <div className={cn('flex justify-between gap-3', strong && 'font-semibold border-t border-border pt-1.5')}>
      <span className={strong ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={cn('tabular-nums', cls)}>{formatCurrency(value)}</span>
    </div>
  );
  return (
    <div className="rounded-xl bg-background/60 border border-border px-3 py-2.5 space-y-1.5 text-xs">
      <p className="text-[11px] text-muted-foreground">
        A conta de <span className="capitalize">{name}</span>{installments > 1 ? ' (o mês mais apertado)' : ''}:
      </p>
      <Row label="Você recebe" value={impact.income} />
      <Row label="− Contas e gastos do mês" value={impact.expense} />
      <Row label="= Sobra sem a compra" value={impact.freeBefore} strong cls={impact.freeBefore < 0 ? 'text-destructive' : undefined} />
      <Row label={installments > 1 ? '− Parcela desta compra' : '− Esta compra'} value={impact.charge} />
      <Row
        label="= Sobra com a compra" value={impact.freeAfter} strong
        cls={impact.status === 'negative' ? 'text-destructive' : impact.status === 'tight' ? 'text-warning' : 'text-success'}
      />
      <p className="text-[11px] text-muted-foreground pt-0.5">
        O ideal é sobrar pelo menos {formatCurrency(impact.cushion)} (reserva para imprevistos{impact.cushion > impact.income * DEFAULT_RESERVE_RATIO + 0.01 ? ' + metas' : ''}).
      </p>
    </div>
  );
}
