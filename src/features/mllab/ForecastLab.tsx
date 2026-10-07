// Laboratório de previsão: o usuário escolhe um padrão de gasto, o motor de ML prevê
// os últimos meses SEM vê-los, e a tela compara previsão x realidade.

import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/helpers';
import { addMonthsStr, forecastSeries, MODEL_LABELS } from '@/lib/ml/forecast';
import { cn } from '@/lib/utils';
import { generateSeries, PROFILES, type ProfileId } from './synthetic';

const START = '2023-01';
const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(y).slice(2)}`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Slider({ id, label, value, min, max, step = 1, onChange, format }: {
  id: string; label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span><span className="font-semibold text-foreground tabular-nums">{format ? format(value) : value}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone === 'good' && 'text-emerald-400', tone === 'warn' && 'text-amber-400')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function ForecastLab() {
  const [profile, setProfile] = useState<ProfileId>('sazonal');
  const [history, setHistory] = useState(18);
  const [holdout, setHoldout] = useState(3);
  const [noise, setNoise] = useState(0.12);
  const [seed, setSeed] = useState(7);

  const lab = useMemo(() => {
    const all = generateSeries({ profile, months: history + holdout, noise, seed });
    const train = all.slice(0, history);
    const truth = all.slice(history);
    const lastMonth = addMonthsStr(START, history - 1);
    const fc = forecastSeries(train, { lastMonth, horizon: holdout });

    const rows: { label: string; treino?: number; real?: number; previsto?: number; faixa?: [number, number] }[] =
      train.map((v, i) => ({ label: monthShort(addMonthsStr(START, i)), treino: v }));
    rows[rows.length - 1].previsto = train[train.length - 1];
    fc.points.forEach((p, i) => rows.push({
      label: monthShort(p.month), real: truth[i], previsto: p.mean, faixa: [p.lower, p.upper],
    }));

    const absErr = fc.points.map((p, i) => Math.abs(p.mean - truth[i]));
    const naiveErr = truth.map((v) => Math.abs(train[train.length - 1] - v));
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    const inside = fc.points.filter((p, i) => truth[i] >= p.lower && truth[i] <= p.upper).length;
    return {
      fc, rows, truth,
      holdMae: sum(absErr) / absErr.length,
      naiveMae: sum(naiveErr) / naiveErr.length,
      inside,
      splitLabel: rows[history].label,
    };
  }, [profile, history, holdout, noise, seed]);

  const { fc, holdMae, naiveMae, inside } = lab;
  const bt = fc.backtest;
  const beats = holdMae < naiveMae;
  const summary = `Previsão dos últimos ${holdout} meses escondidos do modelo: erro médio de ${formatCurrency(holdMae)} `
    + `contra ${formatCurrency(naiveMae)} de repetir o último mês.`;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4 rounded-2xl border border-border bg-card p-4 h-fit" aria-label="Parâmetros da simulação">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Padrão de gasto</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {PROFILES.map((p) => (
              <button key={p.id} type="button" onClick={() => setProfile(p.id)} aria-pressed={profile === p.id}
                className={cn('rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
                  profile === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{PROFILES.find((p) => p.id === profile)?.description}</p>
        </fieldset>
        <Slider id="lab-history" label="Meses de histórico" value={history} min={3} max={24} onChange={setHistory} />
        <Slider id="lab-holdout" label="Meses escondidos do modelo" value={holdout} min={1} max={6} onChange={setHoldout} />
        <Slider id="lab-noise" label="Ruído" value={noise} min={0.02} max={0.4} step={0.02} onChange={setNoise} format={pct} />
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw size={13} aria-hidden /> Gerar outra amostra
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Dados sintéticos, gerados no seu navegador. Como o "futuro" é conhecido, dá para conferir se a previsão acerta.
        </p>
      </aside>

      <div className="space-y-4 min-w-0">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-1">Previsão x realidade</p>
          <p className="text-xs text-muted-foreground mb-3">
            O modelo só viu o histórico até <strong className="text-foreground">{lab.rows[history - 1].label}</strong>. Os meses seguintes são previstos e comparados com o que realmente aconteceu.
          </p>
          <div className="h-64" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lab.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip formatter={(v: unknown) => (Array.isArray(v) ? `${formatCurrency(v[0])} – ${formatCurrency(v[1])}` : formatCurrency(Number(v)))}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <ReferenceLine x={lab.splitLabel} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Area dataKey="faixa" name="Faixa 80%" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.16} isAnimationActive={false} />
                <Line dataKey="treino" name="Histórico (treino)" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                <Line dataKey="real" name="Real (escondido)" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="previsto" name="Previsto" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avaliação</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Erro do modelo" value={formatCurrency(holdMae)} sub="nos meses escondidos" tone={beats ? 'good' : 'warn'} />
            <Stat label="Erro de “repetir o mês”" value={formatCurrency(naiveMae)} sub="linha de base" />
            <Stat label="Real dentro da faixa" value={`${inside}/${holdout}`} sub="meta ≈ 80%" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fc.reliable ? (
              <>
                Modelo escolhido: <strong className="text-foreground">{MODEL_LABELS[fc.model as keyof typeof MODEL_LABELS] ?? fc.model}</strong>,
                selecionado por backtest em {bt?.steps} testes retroativos dentro do treino (erro {bt ? pct(bt.wape) : '—'} do gasto).{' '}
                {beats
                  ? 'Nos meses escondidos ele errou menos do que repetir o último mês.'
                  : 'Nos meses escondidos ele não superou “repetir o último mês” — com poucos meses ou muito ruído isso acontece, e o app avisa em vez de esconder.'}
              </>
            ) : (
              <>Com menos de 5 meses o modelo <strong className="text-foreground">não consegue se validar</strong>: usa a mediana e marca a previsão como não confiável.</>
            )}
          </p>
          {fc.candidates.length > 0 && (
            <table className="w-full text-xs">
              <caption className="sr-only">Erro médio de cada modelo candidato no backtest</caption>
              <thead><tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-1 font-medium">Modelo testado</th>
                <th scope="col" className="pb-1 text-right font-medium">MAE no backtest</th>
              </tr></thead>
              <tbody>
                {[...fc.candidates].sort((a, b) => a.mae - b.mae).map((c) => (
                  <tr key={c.model} className={cn('border-t border-border/50', c.model === fc.model && 'font-semibold text-primary')}>
                    <td className="py-1">{MODEL_LABELS[c.model as keyof typeof MODEL_LABELS] ?? c.model}{c.model === fc.model && ' ✓'}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(c.mae)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
