// Simulador de previsão com dados de exemplo:
//  1. prevê os PRÓXIMOS meses (a partir do mês atual);
//  2. mostra em que a previsão se baseia (meses usados, método e a conta);
//  3. testa o método escondendo os últimos meses e comparando previsão x realidade.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Lightbulb, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { addMonthsStr, forecastSeries } from '@/lib/ml/forecast';
import { cn } from '@/lib/utils';
import { generateSeries, PROFILES, type ProfileId } from './synthetic';

const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(y).slice(2)}`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Nomes em linguagem simples para cada método de previsão.
const METHOD_LABELS: Record<string, string> = {
  ingenuo: 'Repetir o último mês',
  media_movel: 'Média dos últimos 3 meses',
  mediana_robusta: 'Valor típico dos últimos 6 meses',
  suavizacao_exp: 'Média que dá mais peso aos meses recentes',
  tendencia_amortecida: 'Seguir a tendência de alta ou queda',
};
const methodLabel = (m: string) => METHOD_LABELS[m] ?? m;

// Em palavras simples: o que cada método faz e quantos dos últimos meses ele usa (null = todos).
const METHOD_INFO: Record<string, { how: string; uses: number | null }> = {
  ingenuo: { how: 'Considera que o próximo mês será igual ao último.', uses: 1 },
  media_movel: { how: 'Tira a média dos últimos 3 meses.', uses: 3 },
  mediana_robusta: { how: 'Pega o valor do meio dos últimos 6 meses, o que ignora um mês muito fora do normal.', uses: 6 },
  suavizacao_exp: { how: 'Faz uma média de todos os meses, dando mais peso aos mais recentes.', uses: null },
  tendencia_amortecida: { how: 'Vê se o gasto está subindo ou caindo e continua essa tendência aos poucos, sem exagerar.', uses: null },
};
const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long' });
};

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

/** Área rolável na horizontal: arraste com o mouse ou deslize com o dedo para ver todos os meses. */
function DragScroll({ children, width, resetKey }: { children: ReactNode; width: number; resetKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  // começa mostrando o fim (meses mais recentes)
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [resetKey, width]);

  return (
    <div
      ref={ref}
      className={cn('h-full overflow-x-auto overscroll-x-contain select-none', grabbing ? 'cursor-grabbing' : 'cursor-grab')}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return; // toque já rola nativamente
        drag.current = { x: e.clientX, left: ref.current.scrollLeft };
        setGrabbing(true);
        ref.current.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current || !ref.current) return;
        ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
      }}
      onPointerUp={() => { drag.current = null; setGrabbing(false); }}
      onPointerCancel={() => { drag.current = null; setGrabbing(false); }}
    >
      <div style={{ width: `max(100%, ${width}px)`, height: '100%' }}>{children}</div>
    </div>
  );
}

export default function ForecastLab() {
  const [profile, setProfile] = useState<ProfileId>('sazonal');
  const [history, setHistory] = useState(18);
  const [noise, setNoise] = useState(0.12);
  const [seed, setSeed] = useState(7);

  const lab = useMemo(() => {
    const now = getCurrentMonth();
    // O app "conhece" os gastos até o mês passado; a previsão começa no mês atual.
    const lastKnown = addMonthsStr(now, -1);
    const start = addMonthsStr(lastKnown, -(history - 1));
    const startMonthOfYear = Number(start.split('-')[1]) - 1;
    const known = generateSeries({ profile, months: history, noise, seed, startMonthOfYear });
    const knownMonths = known.map((_, i) => addMonthsStr(start, i));

    // 1) Previsão de verdade: próximos 3 meses (este mês, o próximo e o seguinte)
    const future = forecastSeries(known, { lastMonth: lastKnown, horizon: 3 });
    const futureRows: { label: string; real?: number; previsto?: number; faixa?: [number, number] }[] =
      known.map((v, i) => ({ label: monthShort(knownMonths[i]), real: v }));
    futureRows[futureRows.length - 1].previsto = known[known.length - 1];
    future.points.forEach((p) => futureRows.push({ label: monthShort(p.month), previsto: p.mean, faixa: [p.lower, p.upper] }));

    // 3) Teste: esconde os últimos meses, prevê e compara com o que aconteceu
    const holdout = history >= 6 ? 3 : Math.max(1, history - 2);
    const train = known.slice(0, history - holdout);
    const truth = known.slice(history - holdout);
    const testLast = knownMonths[history - holdout - 1];
    const fc = forecastSeries(train, { lastMonth: testLast, horizon: holdout });
    const testRows: { label: string; treino?: number; real?: number; previsto?: number; faixa?: [number, number] }[] =
      train.map((v, i) => ({ label: monthShort(knownMonths[i]), treino: v }));
    testRows[testRows.length - 1].previsto = train[train.length - 1];
    fc.points.forEach((p, i) => testRows.push({
      label: monthShort(p.month), real: truth[i], previsto: p.mean, faixa: [p.lower, p.upper],
    }));

    const absErr = fc.points.map((p, i) => Math.abs(p.mean - truth[i]));
    const naiveErr = truth.map((v) => Math.abs(train[train.length - 1] - v));
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    const inside = fc.points.filter((p, i) => truth[i] >= p.lower && truth[i] <= p.upper).length;
    return {
      now, lastKnown, known, knownMonths, future, futureRows,
      holdout, fc, testRows, truth, testSplit: testRows[history - holdout - 1].label,
      holdMae: sum(absErr) / absErr.length,
      naiveMae: sum(naiveErr) / naiveErr.length,
      inside,
    };
  }, [profile, history, noise, seed]);

  const { fc, holdMae, naiveMae, inside, holdout, future, known, knownMonths, now } = lab;
  const bt = fc.backtest;
  const beats = holdMae < naiveMae;
  const first = future.points[0];
  const info = METHOD_INFO[future.model];
  const usedCount = Math.min(known.length, info ? (info.uses ?? known.length) : known.length);
  const usedFrom = Math.max(0, known.length - usedCount);
  const usedValues = known.slice(usedFrom);
  const resetKey = `${profile}-${history}-${noise}-${seed}`;
  const summary = `Previsão dos últimos ${holdout} meses, que o app não viu: errou em média ${formatCurrency(holdMae)}, `
    + `contra ${formatCurrency(naiveMae)} se apenas repetisse o último mês.`;
  const monthTitle = (ym: string, i: number) =>
    `${monthName(ym)}${ym === now ? ' (este mês)' : i === 1 ? ' (próximo mês)' : ''}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4 rounded-2xl border border-border bg-card p-4 h-fit" aria-label="Ajustes do teste">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tipo de gasto de exemplo</legend>
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
        <Slider id="lab-history" label="Quantos meses o app conhece" value={history} min={3} max={24} onChange={setHistory} />
        <Slider id="lab-noise" label="Quanto o gasto oscila de mês a mês" value={noise} min={0.02} max={0.4} step={0.02} onChange={setNoise} format={pct} />
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw size={13} aria-hidden /> Gerar outro exemplo
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Os gastos são de exemplo, não são os seus. No app de verdade, a previsão usa os seus gastos variáveis e as compras à vista no cartão.
        </p>
      </aside>

      <div className="space-y-4 min-w-0">
        {/* 1) A previsão */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Quanto você vai gastar nos próximos meses</p>
            <p className="text-xs text-muted-foreground">Previsão do gasto variável (o que não é fixo nem parcela), com base nos meses anteriores.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {future.points.map((p, i) => (
              <Stat key={p.month} label={monthTitle(p.month, i)} value={formatCurrency(p.mean)}
                sub={`normalmente entre ${formatCurrency(p.lower)} e ${formatCurrency(p.upper)}`} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Arraste para os lados (ou deslize com o dedo) para ver todos os meses. Linha cheia = gasto já conhecido · tracejada = previsão · faixa = onde o gasto costuma ficar.</p>
          <div className="h-64" role="img" aria-label={`Previsão para ${monthName(first.month)}: ${formatCurrency(first.mean)}`}>
            <DragScroll width={lab.futureRows.length * 46} resetKey={resetKey}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lab.futureRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(v: unknown) => (Array.isArray(v) ? `${formatCurrency(v[0])} – ${formatCurrency(v[1])}` : formatCurrency(Number(v)))}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <ReferenceLine x={lab.futureRows[known.length - 1].label} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <Area dataKey="faixa" name="Faixa provável" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.16} isAnimationActive={false} />
                  <Line dataKey="real" name="Gasto conhecido" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
                  <Line dataKey="previsto" name="Previsão" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </DragScroll>
          </div>
        </div>

        {/* 2) Em que se baseia */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Em que essa previsão se baseia</p>
          <ol className="space-y-2 text-sm leading-relaxed">
            <li className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">1</span>
              <span>O app olha os <strong>{known.length} meses</strong> de gasto que conhece, de <strong>{monthShort(knownMonths[0])}</strong> a <strong>{monthShort(lab.lastKnown)}</strong>. {monthName(now)} fica de fora do histórico porque ainda não terminou.</span></li>
            <li className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">2</span>
              <span>Ele testa 5 jeitos de prever (veja a tabela mais abaixo) e escolhe o que menos errou nesses meses. Aqui ganhou: <strong>{methodLabel(future.model)}</strong>.</span></li>
            <li className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">3</span>
              <span>{info ? info.how : 'Aplica o método escolhido aos meses conhecidos.'}</span></li>
          </ol>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              {info?.uses === null ? 'Meses considerados (todos, com mais peso nos recentes)' : `Meses que pesam na conta (${usedCount})`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {known.slice(-12).map((v, i, arr) => {
                const idx = known.length - arr.length + i;
                const used = idx >= usedFrom;
                return (
                  <span key={knownMonths[idx]} className={cn('rounded-lg border px-2 py-1 text-[11px] tabular-nums',
                    used ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground')}>
                    <span className="block text-[10px] text-muted-foreground">{monthShort(knownMonths[idx])}</span>{formatCurrency(v)}
                  </span>
                );
              })}
            </div>
            {future.reliable && (future.model === 'ingenuo' || future.model === 'media_movel') && (
              <p className="mt-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs tabular-nums">
                A conta: {future.model === 'ingenuo'
                  ? `${formatCurrency(usedValues[usedValues.length - 1])} (o último mês)`
                  : `(${usedValues.map((v) => formatCurrency(v)).join(' + ')}) ÷ ${usedValues.length}`}
                {' '}= <strong>{formatCurrency(first.mean)}</strong>
              </p>
            )}
            {!future.reliable && (
              <p className="mt-2 text-xs text-amber-400">Com menos de 5 meses o app não consegue se testar. Ele usa o valor típico dos meses e avisa que não é confiável.</p>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            A <strong className="text-foreground">faixa</strong> (“normalmente entre…”) vem do quanto o método errou nos testes: quem erra mais ganha uma faixa mais larga. Quanto mais longe o mês, mais larga ela fica.
          </p>
        </div>

        {/* 3) Dá para confiar? */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-1">Previsão x o que realmente aconteceu</p>
          <p className="text-xs text-muted-foreground mb-2">Para saber se dá para confiar, o app esconde os últimos {holdout} meses, prevê e confere.</p>
          <p className={cn('mb-3 rounded-xl px-3 py-2 text-sm font-medium',
            beats ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
            {beats
              ? `A previsão acertou melhor: errou ${formatCurrency(holdMae)} por mês, contra ${formatCurrency(naiveMae)} se só repetisse o último mês.`
              : `Desta vez a previsão não ganhou: errou ${formatCurrency(holdMae)} por mês, contra ${formatCurrency(naiveMae)} se só repetisse o último mês.`}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            O app só enxergou os gastos até <strong className="text-foreground">{lab.testRows[history - holdout - 1].label}</strong>. Os meses seguintes foram previstos e depois comparados com o que realmente aconteceu.
          </p>
          <div className="h-56" role="img" aria-label={summary}>
            <DragScroll width={lab.testRows.length * 46} resetKey={resetKey}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lab.testRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(v: unknown) => (Array.isArray(v) ? `${formatCurrency(v[0])} – ${formatCurrency(v[1])}` : formatCurrency(Number(v)))}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <ReferenceLine x={lab.testSplit} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <Area dataKey="faixa" name="Faixa provável" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.16} isAnimationActive={false} />
                  <Line dataKey="treino" name="Gastos já conhecidos" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line dataKey="real" name="O que realmente aconteceu" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="previsto" name="Previsão" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </DragScroll>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como a previsão se saiu</p>
          </div>
          <div className="stat-grid gap-2">
            <Stat label="Erro da previsão" value={formatCurrency(holdMae)} sub="quanto errou, em média, por mês" tone={beats ? 'good' : 'warn'} />
            <Stat label="Se só repetisse o último mês" value={formatCurrency(naiveMae)} sub="erro da conta mais simples" />
            <Stat label="Dentro da faixa provável" value={`${inside}/${holdout}`} sub="meses em que o real ficou na faixa (ideal: ~8 em 10)" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fc.reliable ? (
              <>
                Método escolhido: <strong className="text-foreground">{methodLabel(fc.model)}</strong>.
                O app testou {bt?.steps} vezes cada método usando só os meses já conhecidos e ficou com o que errou menos
                (erro de cerca de {bt ? pct(bt.wape) : '—'} do gasto).{' '}
                {beats
                  ? 'Nos meses que ficaram escondidos, ele errou menos do que simplesmente repetir o último mês.'
                  : 'Nos meses que ficaram escondidos, ele não foi melhor do que repetir o último mês. Isso acontece quando há poucos meses de histórico ou os gastos variam muito, e o app mostra isso em vez de esconder.'}
              </>
            ) : (
              <>Com menos de 5 meses de histórico o app <strong className="text-foreground">não consegue se validar</strong>: usa o valor típico dos meses e avisa que a previsão não é confiável.</>
            )}
          </p>
          {future.candidates.length > 0 && (
            <div className="overflow-x-auto -mx-1 px-1"><table className="w-full text-xs">
              <caption className="sr-only">Erro médio de cada método testado</caption>
              <thead><tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-1 font-medium">Método testado (com todos os {known.length} meses)</th>
                <th scope="col" className="pb-1 text-right font-medium">Erro médio nos testes</th>
              </tr></thead>
              <tbody>
                {[...future.candidates].sort((a, b) => a.mae - b.mae).map((c) => (
                  <tr key={c.model} className={cn('border-t border-border/50', c.model === future.model && 'font-semibold text-primary')}>
                    <td className="py-1">{methodLabel(c.model)}{c.model === future.model && ' ✓'}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(c.mae)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-primary" aria-hidden />
            <p className="text-sm font-semibold">O que isso significa na prática</p>
          </div>
          <ul className="space-y-1.5 text-sm leading-relaxed list-disc pl-5 marker:text-primary">
            {!future.reliable ? (
              <>
                <li>Com poucos meses registrados, o app ainda não consegue se testar. A previsão aparece, mas com aviso de que <strong>não é confiável</strong>.</li>
                <li>Quanto mais meses você registrar, melhor ele aprende o seu padrão. A partir de uns 5 meses a previsão já é validada.</li>
              </>
            ) : (
              <>
                <li>
                  Para <strong>{monthName(first.month)}</strong> o app previu cerca de <strong>{formatCurrency(first.mean)}</strong> de gasto variável,
                  com faixa normal entre {formatCurrency(first.lower)} e {formatCurrency(first.upper)}.
                  No seu uso real, é esse tipo de número que aparece em Relatórios como gasto esperado do mês.
                </li>
                <li>
                  {beats
                    ? 'Dá para usar como referência para se planejar: separe esse valor no orçamento e trate a faixa como o intervalo "normal". Passar um pouco disso é esperado.'
                    : 'Neste exemplo a previsão não foi melhor que repetir o último mês. Use como uma referência aproximada, não como promessa: com gastos que oscilam muito, ninguém acerta com precisão.'}
                </li>
              </>
            )}
            <li>Nada disso muda o que você gastou: é só uma estimativa para ajudar a decidir antes do mês acontecer.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
