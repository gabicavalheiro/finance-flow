// Painel "Previsão com ML" — gasto variável esperado, banda de confiança e qualidade do modelo.
//
// Honestidade na interface: o painel mostra o quanto o modelo ERRA em testes retroativos e se
// ele ao menos supera "repetir o último mês". Se não superar, diz isso em vez de fingir precisão.

import { useMemo } from 'react';
import { Brain, Cpu, Cloud, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/helpers';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { CreditCard, Expense } from '@/lib/types';
import { MODEL_LABELS, type PortfolioForecast } from '@/lib/ml/forecast';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import { cn } from '@/lib/utils';
import { useSpendingForecast } from './useSpendingForecast';

const MODEL_LABEL_EXTRA: Record<string, string> = {
  ridge_global: 'Ridge global (todas as categorias)',
  ensemble: 'Ensemble (média de 4 modelos)',
};
const modelLabel = (m: string) => (MODEL_LABELS as Record<string, string>)[m] ?? MODEL_LABEL_EXTRA[m] ?? m;

const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const monthLong = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

interface Props {
  expenses: Expense[];
  cards: CreditCard[];
  currentMonth: string;
  /** parcelas + gastos fixos já conhecidos, por mês (YYYY-MM) */
  committedByMonth: Record<string, number>;
  /** receita fixa mensal */
  monthlyIncome: number;
}

export default function SpendingForecastPanel({
  expenses, cards, currentMonth, committedByMonth, monthlyIncome,
}: Props) {
  const { status, history, forecast, apiStatus, reload } = useSpendingForecast({ expenses, cards, currentMonth });

  if (status === 'loading') return <LoadingState rows={2} label="Calculando previsão…" />;
  if (status === 'error') {
    return <ErrorState title="Não consegui carregar seu histórico" message="A previsão precisa dos seus gastos variáveis." onRetry={reload} />;
  }
  if (!history || !history.lastMonth || !forecast) {
    return (
      <EmptyState
        icon={<Brain size={18} aria-hidden />}
        title="Ainda não há histórico para prever"
        description="Registre gastos variáveis e compras à vista no cartão. Com 5 meses completos o modelo consegue se validar sozinho."
      />
    );
  }

  return <Loaded history={history} forecast={forecast} apiStatus={apiStatus}
    committedByMonth={committedByMonth} monthlyIncome={monthlyIncome} />;
}

function Loaded({
  history, forecast, apiStatus, committedByMonth, monthlyIncome,
}: {
  history: NonNullable<ReturnType<typeof useSpendingForecast>['history']>;
  forecast: PortfolioForecast;
  apiStatus: ReturnType<typeof useSpendingForecast>['apiStatus'];
  committedByMonth: Record<string, number>;
  monthlyIncome: number;
}) {
  const bt = forecast.totalBacktest;

  const chartData = useMemo(() => {
    const totals = history.months.map((m, i) => ({
      month: m,
      real: Object.values(history.byCategory).reduce((s, v) => s + v[i], 0),
    }));
    const recent = totals.slice(-12);
    const rows: { month: string; label: string; real?: number; previsto?: number; faixa?: [number, number] }[] =
      recent.map((r) => ({ month: r.month, label: monthShort(r.month), real: r.real }));
    // ponto de ligação: a linha prevista começa no último valor real
    if (rows.length) rows[rows.length - 1].previsto = rows[rows.length - 1].real;
    forecast.total.forEach((p) =>
      rows.push({ month: p.month, label: monthShort(p.month), previsto: p.mean, faixa: [p.lower, p.upper] }));
    return rows;
  }, [history, forecast]);

  const first = forecast.total[0];
  const committed = committedByMonth[first.month] ?? 0;
  const expectedTotal = committed + first.mean;
  const balance = monthlyIncome - expectedTotal;
  const balanceLow = monthlyIncome - (committed + first.upper);
  const balanceHigh = monthlyIncome - (committed + first.lower);

  const categories = useMemo(
    () => Object.entries(forecast.byKey)
      .map(([key, f]) => ({ key, f, next: f.points[0]?.mean ?? 0 }))
      .sort((a, b) => b.next - a.next)
      .slice(0, 6),
    [forecast],
  );

  const beatsBaseline = bt ? bt.skill > 0.05 : false;
  const summary = `Previsão de gastos variáveis para ${monthLong(first.month)}: ${formatCurrency(first.mean)}, `
    + `com faixa de ${formatCurrency(first.lower)} a ${formatCurrency(first.upper)}.`;

  return (
    <section aria-labelledby="ml-forecast-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain size={14} className="text-primary" aria-hidden />
          </div>
          <h3 id="ml-forecast-title" className="text-sm font-bold">Previsão com ML</h3>
        </div>
        <EngineBadge engine={forecast.engine} apiStatus={apiStatus} />
      </div>

      {!forecast.reliable && (
        <div role="status" className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" aria-hidden />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Só há <strong className="text-foreground">{forecast.n} {forecast.n === 1 ? 'mês completo' : 'meses completos'}</strong> de
            histórico. É pouco para validar o modelo: trate os números como uma referência, não como previsão.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label={`Gasto variável · ${monthShort(first.month)}`} value={formatCurrency(first.mean)}
          hint={`faixa ${formatCurrency(first.lower)} – ${formatCurrency(first.upper)}`} />
        <Kpi label="Gasto total esperado" value={formatCurrency(expectedTotal)}
          hint={`${formatCurrency(committed)} já comprometido + variável`} />
        <Kpi label="Saldo esperado" value={formatCurrency(balance)} tone={balance < 0 ? 'bad' : 'good'}
          hint={`entre ${formatCurrency(balanceLow)} e ${formatCurrency(balanceHigh)}`} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
          Gasto variável — histórico e previsão
        </p>
        <p className="text-[10px] text-muted-foreground mb-3">
          Linha cheia = realizado · tracejada = previsto · faixa = intervalo de 80%
        </p>
        <div className="h-56" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                width={52} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
              <Tooltip content={<ForecastTooltip />} />
              <ReferenceLine x={chartData.find((r) => r.faixa)?.label} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <Area dataKey="faixa" name="Faixa 80%" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.16} isAnimationActive={false} />
              <Line dataKey="real" name="Realizado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="previsto" name="Previsto" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-primary" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quanto confiar neste modelo</p>
        </div>

        {bt ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Erro médio" value={pct(bt.wape)} sub="do gasto" />
              <Metric label="vs. “repetir o mês”" value={`${bt.skill >= 0 ? '−' : '+'}${pct(Math.abs(bt.skill))}`} sub="de erro"
                tone={beatsBaseline ? 'good' : 'warn'} />
              <Metric label="Faixa acertou" value={bt.coverage === null ? '—' : pct(bt.coverage)} sub="meta ≈ 80%" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {beatsBaseline
                ? <>Em {bt.steps} testes retroativos, o modelo <strong className="text-foreground">{modelLabel(String(forecast.totalModel))}</strong> errou
                    {' '}{pct(bt.skill)} menos do que simplesmente repetir o gasto do mês anterior.</>
                : <>Em {bt.steps} testes retroativos o modelo <strong className="text-foreground">não superou claramente</strong> “repetir o mês anterior”.
                    Seus gastos variam sem um padrão forte — use a faixa, não o valor central.</>}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sem testes retroativos ainda: precisa de pelo menos 5 meses completos.</p>
        )}

        {forecast.totalCandidates.length > 0 && (
          <table className="w-full text-xs">
            <caption className="sr-only">Erro médio absoluto de cada modelo candidato nos testes retroativos</caption>
            <thead>
              <tr className="text-muted-foreground text-left">
                <th scope="col" className="font-medium pb-1">Modelo testado</th>
                <th scope="col" className="font-medium pb-1 text-right">Erro médio (MAE)</th>
              </tr>
            </thead>
            <tbody>
              {[...forecast.totalCandidates].sort((a, b) => a.mae - b.mae).map((c) => {
                const chosen = c.model === forecast.totalModel;
                return (
                  <tr key={c.model} className={cn('border-t border-border', chosen && 'font-semibold text-primary')}>
                    <td className="py-1">{modelLabel(String(c.model))}{chosen && ' ✓'}</td>
                    <td className="py-1 text-right tabular-nums">{Number.isFinite(c.mae) ? formatCurrency(c.mae) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none flex items-center gap-1.5 font-medium text-foreground">
            <Info size={12} aria-hidden /> Como a previsão é feita
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-4 leading-relaxed">
            <li>Só entra o que é <strong>decisão nova</strong>: gastos variáveis e compras à vista no cartão. Parcelas, gastos fixos e assinaturas já são conhecidos e somados por cima.</li>
            <li>O mês atual fica fora do treino (está incompleto) e é previsto como um mês inteiro.</li>
            <li>Vários modelos disputam entre si em testes retroativos (prevendo cada mês só com os anteriores); vence o de menor erro.</li>
            <li>A faixa de 80% vem do erro desses testes e alarga com a distância. O total é previsto direto da soma das categorias (e não somando as faixas), porque categorias tendem a variar juntas.</li>
          </ul>
        </details>
      </div>

      {categories.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Por categoria · {monthShort(first.month)}
          </p>
          <table className="w-full text-xs">
            <caption className="sr-only">Previsão do próximo mês por categoria</caption>
            <thead>
              <tr className="text-muted-foreground text-left">
                <th scope="col" className="font-medium pb-1">Categoria</th>
                <th scope="col" className="font-medium pb-1 text-right">Previsto</th>
                <th scope="col" className="font-medium pb-1 text-right hidden sm:table-cell">Modelo</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(({ key, f, next }) => (
                <tr key={key} className="border-t border-border">
                  <td className="py-1.5">{(CATEGORY_CONFIG as Record<string, { label: string }>)[key]?.label ?? key}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatCurrency(next)}
                    {!f.reliable && <span className="text-warning" title="Poucos meses de histórico"> *</span>}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">{modelLabel(String(f.model))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.some((c) => !c.f.reliable) && (
            <p className="text-[10px] text-muted-foreground mt-2">* poucos meses de histórico nessa categoria.</p>
          )}
        </div>
      )}
    </section>
  );
}

function EngineBadge({ engine, apiStatus }: { engine: 'local' | 'api'; apiStatus: string }) {
  if (engine === 'api') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
        <Cloud size={10} aria-hidden /> API Python · scikit-learn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
      title={apiStatus === 'failed' ? 'A API não respondeu; usando o modelo do navegador.' : undefined}>
      <Cpu size={10} aria-hidden />
      {apiStatus === 'loading' ? 'Modelo local · consultando API…'
        : apiStatus === 'failed' ? 'Modelo local · API indisponível' : 'Modelo local'}
    </span>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-lg font-bold mt-1 tabular-nums', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-success')}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl bg-muted/40 px-2 py-2.5">
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', tone === 'good' && 'text-success', tone === 'warn' && 'text-warning')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold capitalize mb-1">{label}</p>
      {row.real !== undefined && <p>Realizado: <strong>{formatCurrency(row.real)}</strong></p>}
      {row.faixa && (
        <>
          <p>Previsto: <strong>{formatCurrency(row.previsto)}</strong></p>
          <p className="text-muted-foreground">Faixa: {formatCurrency(row.faixa[0])} – {formatCurrency(row.faixa[1])}</p>
        </>
      )}
    </div>
  );
}
