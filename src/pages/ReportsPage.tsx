// src/pages/ReportsPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingDown, TrendingUp, Scale, ChevronDown, ChevronUp,
  Sparkles, AlertTriangle, CheckCircle2, Clock, CreditCard as CreditCardIcon,
  Activity,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import { getCurrentMonth, formatCurrency, addMonths } from '@/lib/helpers';
import {
  getCards, getExpenses, getFixedExpenses, getIncomes,
  computeInstallmentsForMonth, computeCategoryTotals,
  getVariableForMonth,
} from '@/lib/store';
import { CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  CartesianGrid, ReferenceLine, Cell,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';

// ─── Cores ────────────────────────────────────────────────────────────────────
const C = {
  redHot:   '#e05252',
  redMid:   '#8f3d3d',
  redDim:   '#4a2323',
  greenHot: '#3fb87a',
  greenMid: '#276647',
  greenDim: '#1a3d2b',
  purple:   '#8b5cf6',
  amber:    '#f59e0b',
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
function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface MonthForecast {
  month: string; label: string;
  cardExpenses: number; fixedExpenses: number;
  totalExpense: number; totalIncome: number; balance: number;
  isPast: boolean; isCurrent: boolean; isFuture: boolean;
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

// ─── Tooltip dos gráficos de barras ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold mb-1.5 capitalize">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
            {p.name}
          </span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Tooltip do gráfico de fluxo ─────────────────────────────────────────────
function FlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entrada = payload.find((p: any) => p.dataKey === 'entradas');
  const saida   = payload.find((p: any) => p.dataKey === 'saidas');
  const saldo   = payload.find((p: any) => p.dataKey === 'saldo');
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-lg text-xs min-w-[160px]">
      <p className="font-semibold mb-1.5">Dia {label}</p>
      {entrada && (
        <p className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-400" />
            Entradas
          </span>
          <span className="font-medium text-emerald-400">+{formatCurrency(entrada.value)}</span>
        </p>
      )}
      {saida && (
        <p className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
            Saídas
          </span>
          <span className="font-medium text-red-400">-{formatCurrency(saida.value)}</span>
        </p>
      )}
      {saldo && (
        <p className="flex items-center justify-between gap-3 py-0.5 border-t border-border mt-1 pt-1">
          <span className="flex items-center gap-1.5 text-violet-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-violet-400" />
            Saldo acum.
          </span>
          <span className={cn('font-medium', saldo.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {saldo.value >= 0 ? '+' : ''}{formatCurrency(saldo.value)}
          </span>
        </p>
      )}
    </div>
  );
}

// ─── Card de previsão mensal ──────────────────────────────────────────────────
function ForecastCard({ fc }: { fc: MonthForecast }) {
  const [expanded, setExpanded] = useState(false);
  const balanceColor = fc.balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';
  const stripColor   = fc.balance >= fc.totalIncome * 0.3
    ? 'hsl(152 69% 45%)' : fc.balance >= 0
    ? 'hsl(38 92% 50%)' : 'hsl(0 72% 51%)';

  return (
    <div className={cn(
      'bg-card rounded-2xl border border-border overflow-hidden',
      fc.isCurrent && 'ring-1 ring-primary/40',
    )}>
      <div className="h-1" style={{ background: stripColor }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold capitalize">{fc.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <HealthBadge balance={fc.balance} income={fc.totalIncome} />
              {fc.isCurrent && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Mês atual
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-base font-bold" style={{ color: balanceColor }}>
              {fc.balance >= 0 ? '+' : ''}{formatCurrency(fc.balance)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-secondary/50 rounded-xl p-2.5">
            <p className="text-muted-foreground mb-0.5">Receitas</p>
            <p className="font-semibold text-emerald-400">{formatCurrency(fc.totalIncome)}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-2.5">
            <p className="text-muted-foreground mb-0.5">Gastos</p>
            <p className="font-semibold text-destructive">{formatCurrency(fc.totalExpense)}</p>
          </div>
        </div>

        {fc.installmentDetail.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
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
  const [tab, setTab]           = useState<'previsao' | 'historico' | 'fluxo'>('previsao');
  const [month, setMonth]       = useState(getCurrentMonth());
  const [cards, setCards]       = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed]       = useState<FixedExpense[]>([]);
  const [incomes, setIncomes]   = useState<FixedIncome[]>([]);
  const [varTxs, setVarTxs]     = useState<VariableTransaction[]>([]);
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

  // Busca varTxs quando muda o mês (para aba fluxo e historico)
  useEffect(() => {
    getVariableForMonth(month).then(setVarTxs);
  }, [month]);

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

  // ── Fluxo diário ─────────────────────────────────────────────────────────
  const dailyFlowData = useMemo(() => {
    const days = daysInMonth(month);
    // Mapa dia → { entrada, saida }
    const map: Record<number, { entrada: number; saida: number }> = {};
    for (let d = 1; d <= days; d++) map[d] = { entrada: 0, saida: 0 };

    // 1. Ganhos fixos: pelo receiveDay
    for (const inc of incomes) {
      const day = inc.receiveDay ?? 1;
      if (day >= 1 && day <= days) map[day].entrada += inc.amount;
    }

    // 2. Faturas de cartão: pelo dueDay do cartão
    for (const card of cards) {
      const amt = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (amt === 0) continue;
      const day = Math.min(card.dueDay, days);
      map[day].saida += amt;
    }

    // 3. Gastos fixos: dia 1 (não têm dia específico)
    for (const f of fixed) map[1].saida += f.amount;

    // 4. Transações variáveis: pelo dia da data
    for (const tx of varTxs) {
      const day = parseInt(tx.date.split('-')[2], 10);
      if (day >= 1 && day <= days) {
        if (tx.type === 'income')  map[day].entrada += tx.amount;
        else                       map[day].saida   += tx.amount;
      }
    }

    // Montar array com acumulado
    let cumEntrada = 0;
    let cumSaida   = 0;
    return Array.from({ length: days }, (_, i) => {
      const d = i + 1;
      cumEntrada += map[d].entrada;
      cumSaida   += map[d].saida;
      return {
        dia:      d,
        entradas: cumEntrada,
        saidas:   cumSaida,
        saldo:    cumEntrada - cumSaida,
        // valores diários (não acumulados) para tooltip
        dEntrada: map[d].entrada,
        dSaida:   map[d].saida,
      };
    });
  }, [month, incomes, cards, installments, fixed, varTxs]);

  const maxFlow = useMemo(() =>
    Math.max(...dailyFlowData.map(d => Math.max(d.entradas, d.saidas)), 1),
  [dailyFlowData]);

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
    name: monthLabel(fc.month), gastos: fc.totalExpense, receitas: fc.totalIncome,
    isPast: fc.isPast, isCurrent: fc.isCurrent, isFuture: fc.isFuture,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
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
            <p className="text-xs text-muted-foreground">Histórico, fluxo e previsões financeiras</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 md:px-8 mb-5">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {([
            { key: 'previsao',  label: 'Previsão',  icon: <Sparkles size={12} /> },
            { key: 'historico', label: 'Histórico', icon: <BarChart3 size={12} /> },
            { key: 'fluxo',     label: 'Fluxo',     icon: <Activity  size={12} /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon} {t.label}
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
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="gastos" name="Gastos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {barDataForecast.map((e, idx) => (
                          <Cell key={idx} fill={e.isCurrent ? C.redHot : e.isFuture ? C.redMid : C.redDim} />
                        ))}
                      </Bar>
                      <Bar dataKey="receitas" name="Receitas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {barDataForecast.map((e, idx) => (
                          <Cell key={idx} fill={e.isCurrent ? C.greenHot : e.isFuture ? C.greenMid : C.greenDim} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-5 mt-2">
                  {[
                    { color: C.redHot,   label: 'Gastos (atual)'   },
                    { color: C.greenHot, label: 'Receitas (atual)' },
                    { color: C.redDim,   label: 'Passado'          },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
                <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A previsão usa suas <strong className="text-foreground">parcelas cadastradas</strong> e{' '}
                  <strong className="text-foreground">ganhos/gastos fixos</strong>. Gastos variáveis futuros não são incluídos.
                </p>
              </div>

              <div className="space-y-3">
                {forecasts.map((fc, i) => (
                  <motion.div key={fc.month} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
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
                  <p className="text-lg font-bold tabular-nums" style={{ color: (totalFixedIncome - totalHist) >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}>
                    {formatCurrency(totalFixedIncome - totalHist)}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Últimos 6 meses</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barDataHist} barGap={3} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
                      <Bar dataKey="receitas" name="Receitas" fill={C.greenHot} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="gastos"   name="Gastos"   fill={C.redHot}   radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

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
                            style={{ background: `hsl(${cat.color})` }}
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

              {cards.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Por cartão</p>
                  <div className="space-y-3">
                    {cards.map(card => {
                      const cardTotal = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
                      const pct = totalHist > 0 ? (cardTotal / totalHist) * 100 : 0;
                      return (
                        <div key={card.id}>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }} />
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

          {/* ── FLUXO ── */}
          {tab === 'fluxo' && (
            <motion.div
              key="fluxo"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-4 md:px-8 space-y-4"
            >
              <MonthSelector month={month} onChange={setMonth} />

              {/* Cards resumo do mês */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Entradas', value: dailyFlowData[dailyFlowData.length - 1]?.entradas ?? 0, color: 'text-emerald-400' },
                  { label: 'Saídas',   value: dailyFlowData[dailyFlowData.length - 1]?.saidas   ?? 0, color: 'text-destructive' },
                  { label: 'Saldo',    value: dailyFlowData[dailyFlowData.length - 1]?.saldo    ?? 0, color: (dailyFlowData[dailyFlowData.length - 1]?.saldo ?? 0) >= 0 ? 'text-emerald-400' : 'text-destructive' },
                ].map(item => (
                  <div key={item.label} className="bg-card rounded-2xl p-4 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn('text-base font-bold tabular-nums', item.color)}>
                      {item.label === 'Saldo' && item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Gráfico de área — entradas e saídas acumuladas */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Entradas vs Saídas acumuladas
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Valores acumulados dia a dia em {monthLabel(month, false)}
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.greenHot} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.greenHot} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.redHot} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.redHot} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={v => v % 5 === 0 || v === 1 ? String(v) : ''}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false} width={62}
                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                        domain={[0, maxFlow * 1.1]}
                      />
                      <Tooltip content={<FlowTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="entradas"
                        name="Entradas"
                        stroke={C.greenHot}
                        strokeWidth={2}
                        fill="url(#gradEntradas)"
                        dot={false}
                        activeDot={{ r: 4, fill: C.greenHot }}
                      />
                      <Area
                        type="monotone"
                        dataKey="saidas"
                        name="Saídas"
                        stroke={C.redHot}
                        strokeWidth={2}
                        fill="url(#gradSaidas)"
                        dot={false}
                        activeDot={{ r: 4, fill: C.redHot }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-6 h-0.5 rounded-full inline-block" style={{ background: C.greenHot }} />
                    Entradas acumuladas
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-6 h-0.5 rounded-full inline-block" style={{ background: C.redHot }} />
                    Saídas acumuladas
                  </div>
                </div>
              </div>

              {/* Gráfico de linha — saldo acumulado */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Saldo acumulado do mês
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Entradas − saídas a cada dia de {monthLabel(month, false)}
                </p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={v => v % 5 === 0 || v === 1 ? String(v) : ''}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false} tickLine={false} width={62}
                        tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                      />
                      <Tooltip content={<FlowTooltip />} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        name="Saldo"
                        stroke={C.purple}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: C.purple }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-6 h-0.5 rounded-full inline-block" style={{ background: C.purple }} />
                    Saldo acumulado
                  </div>
                </div>
              </div>

              {/* Legenda das fontes */}
              <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
                <Activity size={13} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Entradas:</strong> ganhos fixos (pelo dia de recebimento) + lançamentos variáveis.{' '}
                  <strong className="text-foreground">Saídas:</strong> faturas de cartão (pelo dia de vencimento) + gastos fixos (dia 1) + lançamentos variáveis.
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}
    </div>
  );
}