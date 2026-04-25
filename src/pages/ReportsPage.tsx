import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingDown, TrendingUp, Scale, ChevronDown, ChevronUp,
  Sparkles, AlertTriangle, CheckCircle2, Clock, CreditCard as CreditCardIcon,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import { getCurrentMonth, formatCurrency, addMonths } from '@/lib/helpers';
import {
  getCards, getExpenses, getFixedExpenses, getIncomes,
  computeInstallmentsForMonth, computeCategoryTotals,
} from '@/lib/store';
import { CreditCard, Expense, FixedExpense, FixedIncome } from '@/lib/types';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';

// ─── Cores SVG-safe (hex puro — sem alpha, sem HSL slash notation) ────────────
// Recharts renderiza Cell.fill como atributo SVG; só hex/rgb funcionam 100%
const C = {
  redHot:     '#e05252',  // mês atual / gastos principal
  redMid:     '#8f3d3d',  // futuro gastos
  redDim:     '#4a2323',  // passado gastos
  greenHot:   '#3fb87a',  // mês atual / receitas principal
  greenMid:   '#276647',  // futuro receitas
  greenDim:   '#1a3d2b',  // passado receitas
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function monthLabel(m: string, short = true) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('pt-BR', {
    month: short ? 'short' : 'long',
    year:  short ? undefined : 'numeric',
  });
}
function monthLabelFull(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface MonthForecast {
  month: string;
  label: string;
  cardExpenses: number;
  fixedExpenses: number;
  totalExpense: number;
  totalIncome: number;
  balance: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  cardBreakdown: { cardId: string; cardName: string; amount: number }[];
  installmentDetail: {
    name: string; amount: number;
    installmentNumber: number; totalInstallments: number; cardName: string;
  }[];
}

// ─── Badge de saúde ───────────────────────────────────────────────────────────
function HealthBadge({ balance, income }: { balance: number; income: number }) {
  if (balance >= income * 0.3) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
      <CheckCircle2 size={10} /> Mês tranquilo
    </span>
  );
  if (balance >= 0) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
      <Clock size={10} /> Mês apertado
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
      <AlertTriangle size={10} /> Saldo negativo
    </span>
  );
}

// ─── Tooltip do gráfico ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold mb-1.5 capitalize">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
            {p.name === 'gastos' ? 'Gastos' : 'Receitas'}
          </span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Card de previsão mensal ──────────────────────────────────────────────────
function ForecastCard({ fc }: { fc: MonthForecast }) {
  const [expanded, setExpanded] = useState(false);
  const balanceColor = fc.balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';
  const stripColor   = fc.balance >= fc.totalIncome * 0.3
    ? 'hsl(152 69% 45%)' : fc.balance >= 0
    ? 'hsl(25 95% 53%)' : 'hsl(0 84% 60%)';

  return (
    <div className={cn(
      'bg-card rounded-2xl border overflow-hidden',
      fc.isCurrent ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
    )}>
      {/* faixa colorida de topo */}
      <div className="h-0.5" style={{ background: stripColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <p className="text-sm font-bold capitalize">{fc.label}</p>
              {fc.isCurrent && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  mês atual
                </span>
              )}
              {fc.isPast && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  histórico
                </span>
              )}
              {fc.isFuture && <HealthBadge balance={fc.balance} income={fc.totalIncome} />}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {fc.isFuture
                ? 'Previsão — parcelas + gastos fixos'
                : fc.isCurrent ? 'Dados do mês corrente' : 'Dados históricos'}
            </p>
          </div>
          <p className="text-lg font-bold shrink-0 tabular-nums" style={{ color: balanceColor }}>
            {fc.balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(fc.balance))}
          </p>
        </div>

        {/* Resumo */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-secondary rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <TrendingDown size={10} className="text-destructive" /> Gastos previstos
            </p>
            <p className="text-sm font-bold text-destructive tabular-nums">
              {formatCurrency(fc.totalExpense)}
            </p>
            {fc.cardExpenses > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatCurrency(fc.cardExpenses)} em parcelas
              </p>
            )}
          </div>
          <div className="bg-secondary rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <TrendingUp size={10} className="text-success" /> Renda prevista
            </p>
            <p className="text-sm font-bold text-success tabular-nums">
              {formatCurrency(fc.totalIncome)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ganhos fixos</p>
          </div>
        </div>

        {/* Breakdown por cartão */}
        {fc.cardBreakdown.filter(cb => cb.amount > 0).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            {fc.cardBreakdown.filter(cb => cb.amount > 0).map(cb => (
              <div key={cb.cardId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCardIcon size={11} />
                  <span>{cb.cardName}</span>
                </div>
                <span className="font-medium tabular-nums">{formatCurrency(cb.amount)}</span>
              </div>
            ))}
            {fc.fixedExpenses > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gastos fixos</span>
                <span className="font-medium tabular-nums">{formatCurrency(fc.fixedExpenses)}</span>
              </div>
            )}
          </div>
        )}

        {/* Expandir parcelas */}
        {fc.installmentDetail.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded
                ? 'Ocultar parcelas'
                : `${fc.installmentDetail.length} parcela${fc.installmentDetail.length > 1 ? 's' : ''} neste mês`}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2.5">
                    {fc.installmentDetail.map((inst, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {inst.totalInstallments > 1
                              ? `${inst.installmentNumber}/${inst.totalInstallments} · ${inst.cardName}`
                              : `À vista · ${inst.cardName}`}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {formatCurrency(inst.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab]           = useState<'previsao' | 'historico'>('previsao');
  const [month, setMonth]       = useState(getCurrentMonth());
  const [cards, setCards]       = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed]       = useState<FixedExpense[]>([]);
  const [incomes, setIncomes]   = useState<FixedIncome[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [c, e, f, i] = await Promise.all([
      getCards(), getExpenses(), getFixedExpenses(), getIncomes(),
    ]);
    setCards(c); setExpenses(e); setFixed(f); setIncomes(i);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Histórico ─────────────────────────────────────────────────────────────
  const installments     = useMemo(() => computeInstallmentsForMonth(expenses, cards, month), [expenses, cards, month]);
  const categoryTotals   = useMemo(() => computeCategoryTotals(installments, fixed), [installments, fixed]);
  const totalFixedIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes]);

  const categoryList = useMemo(() =>
    Object.entries(categoryTotals)
      .map(([key, value]) => ({ key, ...resolveCategoryInfo(key), value }))
      .sort((a, b) => b.value - a.value),
  [categoryTotals]);

  const totalHist = categoryList.reduce((s, c) => s + c.value, 0);

  const barDataHist = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const m      = addMonths(month, -(5 - i));
      const inst   = computeInstallmentsForMonth(expenses, cards, m);
      const gastos = inst.reduce((s, x) => s + x.amount, 0) + fixed.reduce((s, f) => s + f.amount, 0);
      return { name: monthLabel(m), gastos, receitas: totalFixedIncome };
    }),
  [month, expenses, cards, fixed, totalFixedIncome]);

  // ── Previsão ──────────────────────────────────────────────────────────────
  const totalFixedExpense = useMemo(() => fixed.reduce((s, f) => s + f.amount, 0), [fixed]);
  const cardMap           = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const current           = getCurrentMonth();

  const forecasts = useMemo((): MonthForecast[] =>
    Array.from({ length: 7 }, (_, i) => {
      const m    = addMonths(current, i - 1);
      const inst = computeInstallmentsForMonth(expenses, cards, m);

      const cardBreakdown = cards.map(card => ({
        cardId:   card.id,
        cardName: card.name,
        amount:   inst.filter(x => x.cardId === card.id).reduce((s, x) => s + x.amount, 0),
      }));

      const cardExpenses = inst.reduce((s, x) => s + x.amount, 0);
      const totalExpense = cardExpenses + totalFixedExpense;
      const totalIncome  = totalFixedIncome;
      const balance      = totalIncome - totalExpense;

      return {
        month: m, label: monthLabelFull(m),
        cardExpenses, fixedExpenses: totalFixedExpense,
        totalExpense, totalIncome, balance,
        isPast:    m < current,
        isCurrent: m === current,
        isFuture:  m > current,
        cardBreakdown,
        installmentDetail: inst.map(x => ({
          name:              x.expenseName,
          amount:            x.amount,
          installmentNumber: x.installmentNumber,
          totalInstallments: x.totalInstallments,
          cardName:          cardMap.get(x.cardId)?.name ?? 'Cartão',
        })),
      };
    }),
  [expenses, cards, totalFixedExpense, totalFixedIncome, cardMap, current]);

  const futureForecasts = forecasts.filter(f => f.isFuture);
  const lightestMonth   = futureForecasts.reduce<MonthForecast | null>(
    (best, fc) => !best || fc.balance > best.balance ? fc : best, null);
  const heaviestMonth   = futureForecasts.reduce<MonthForecast | null>(
    (worst, fc) => !worst || fc.totalExpense > worst.totalExpense ? fc : worst, null);

  const barDataForecast = forecasts.map(fc => ({
    name:      monthLabel(fc.month),
    gastos:    fc.totalExpense,
    receitas:  fc.totalIncome,
    isPast:    fc.isPast,
    isCurrent: fc.isCurrent,
    isFuture:  fc.isFuture,
  }));

  return (
    <div className="pb-24 md:pb-10 max-w-5xl mx-auto">

      {/* Cabeçalho */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatórios</h1>
            <p className="text-xs text-muted-foreground">Histórico e previsões financeiras</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 md:px-8 mb-5">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {(['previsao', 'historico'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'previsao' ? <><Sparkles size={12} /> Previsão</> : <><BarChart3 size={12} /> Histórico</>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-16">Carregando...</p>
      ) : (
        <AnimatePresence mode="wait">

          {/* ── PREVISÃO ── */}
          {tab === 'previsao' && (
            <motion.div
              key="previsao"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-4 md:px-8 space-y-4"
            >
              {/* Destaques */}
              {futureForecasts.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {lightestMonth && (
                    <div className="bg-success/8 border border-success/25 rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 size={13} className="text-success" />
                        <p className="text-[10px] font-semibold text-success uppercase tracking-wide">Mês mais leve</p>
                      </div>
                      <p className="text-sm font-bold capitalize">{monthLabel(lightestMonth.month, false)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sobra <strong className="text-success">{formatCurrency(lightestMonth.balance)}</strong>
                      </p>
                    </div>
                  )}
                  {heaviestMonth && (
                    <div className="bg-destructive/8 border border-destructive/25 rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle size={13} className="text-destructive" />
                        <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Mês mais pesado</p>
                      </div>
                      <p className="text-sm font-bold capitalize">{monthLabel(heaviestMonth.month, false)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <strong className="text-destructive">{formatCurrency(heaviestMonth.totalExpense)}</strong> em gastos
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Gráfico previsão */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Visão geral — passado e futuro
                </p>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Cores mais escuras = passado · mais vivas = futuro/atual
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barDataForecast} barGap={3} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false} width={60}
                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="gastos" name="gastos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {barDataForecast.map((e, idx) => (
                          <Cell key={idx} fill={e.isCurrent ? C.redHot : e.isFuture ? C.redMid : C.redDim} />
                        ))}
                      </Bar>
                      <Bar dataKey="receitas" name="receitas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {barDataForecast.map((e, idx) => (
                          <Cell key={idx} fill={e.isCurrent ? C.greenHot : e.isFuture ? C.greenMid : C.greenDim} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda */}
                <div className="flex items-center justify-center gap-5 mt-2">
                  {[
                    { color: C.redHot,  label: 'Gastos (atual)' },
                    { color: C.greenHot, label: 'Receitas (atual)' },
                    { color: C.redDim,  label: 'Passado' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
                <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A previsão usa suas <strong className="text-foreground">parcelas cadastradas</strong> e{' '}
                  <strong className="text-foreground">ganhos/gastos fixos</strong>. Gastos variáveis futuros não são incluídos.
                </p>
              </div>

              {/* Cards por mês */}
              <div className="space-y-3">
                {forecasts.map((fc, i) => (
                  <motion.div
                    key={fc.month}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <ForecastCard fc={fc} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── HISTÓRICO ── */}
          {tab === 'historico' && (
            <motion.div
              key="historico"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-4 md:px-8 space-y-4"
            >
              <MonthSelector month={month} onChange={setMonth} />

              {/* Resumo rápido */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card rounded-2xl p-4 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp size={10} className="text-success" /> Receitas
                  </p>
                  <p className="text-lg font-bold text-success tabular-nums">{formatCurrency(totalFixedIncome)}</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingDown size={10} className="text-destructive" /> Gastos
                  </p>
                  <p className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(totalHist)}</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <Scale size={10} /> Saldo
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums"
                    style={{ color: (totalFixedIncome - totalHist) >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}
                  >
                    {formatCurrency(totalFixedIncome - totalHist)}
                  </p>
                </div>
              </div>

              {/* Gráfico histórico */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Últimos 6 meses
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barDataHist} barGap={3} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false} width={60}
                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
                      <Bar dataKey="receitas" name="receitas" fill={C.greenHot} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="gastos"   name="gastos"   fill={C.redHot}   radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Por categoria */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Gastos por categoria — {monthLabel(month, false)}
                </p>
                {categoryList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem gastos neste mês</p>
                ) : (
                  <div className="space-y-3">
                    {categoryList.map(cat => (
                      <div key={cat.key}>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-medium">{cat.label}</span>
                          <span className="font-semibold tabular-nums">
                            {formatCurrency(cat.value)}
                            <span className="text-muted-foreground font-normal ml-1">
                              ({totalHist > 0 ? ((cat.value / totalHist) * 100).toFixed(0) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: cat.color }}
                            initial={{ width: 0 }}
                            animate={{ width: totalHist > 0 ? `${(cat.value / totalHist) * 100}%` : '0%' }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Por cartão */}
              {cards.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Por cartão
                  </p>
                  <div className="space-y-3">
                    {cards.map(card => {
                      const cardTotal = installments
                        .filter(i => i.cardId === card.id)
                        .reduce((s, i) => s + i.amount, 0);
                      const pct = totalHist > 0 ? (cardTotal / totalHist) * 100 : 0;
                      return (
                        <div key={card.id}>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }} />
                              <span className="font-medium">{card.name}</span>
                            </div>
                            <span className="font-semibold tabular-nums">{formatCurrency(cardTotal)}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      )}
    </div>
  );
}