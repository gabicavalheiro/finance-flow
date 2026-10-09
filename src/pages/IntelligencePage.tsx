// Inteligência do FinanceFlow: como o app prevê e classifica os gastos (página pública, sem login).

import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, Brain, LineChart, Tags, Info } from 'lucide-react';
import { LoadingState } from '@/components/states/StateViews';
import { cn } from '@/lib/utils';

const ForecastLab   = lazy(() => import('@/features/intelligence/ForecastLab'));
const ClassifierLab = lazy(() => import('@/features/intelligence/ClassifierLab'));

// Cada recurso explicado em linguagem simples: o que faz, onde aparece e como testar.
const TABS = [
  {
    id: 'forecast',
    label: 'Previsão de gastos',
    icon: LineChart,
    what: 'Estima quanto você vai gastar nos próximos meses, olhando o que você gastou antes.',
    where: 'No app: Relatórios → aba de previsão.',
    steps: [
      'Escolha, à esquerda, um tipo de gasto de exemplo e quantos meses o app conhece.',
      'Veja a previsão dos próximos meses, começando por este, e a faixa onde o gasto costuma ficar.',
      'Em "Em que essa previsão se baseia", veja quais meses e qual método foram usados. Mais abaixo, confira se ela costuma acertar.',
    ],
  },
  {
    id: 'classifier',
    label: 'Categoria automática',
    icon: Tags,
    what: 'Sugere a categoria de um gasto (mercado, transporte, saúde…) a partir do nome da compra.',
    where: 'No app: Classificador, ao importar um extrato.',
    steps: [
      'Digite o nome de uma compra, como aparece na fatura, ou toque em um exemplo.',
      'Veja a categoria que o app sugere e quão seguro ele está.',
      'Se a certeza for baixa, o app avisa para você conferir em vez de decidir sozinho.',
    ],
  },
] as const;

export default function IntelligencePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('forecast');
  const current = TABS.find(t => t.id === tab)!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 space-y-5">
      <header className="space-y-3">
        <a href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={12} aria-hidden /> Voltar ao FinanceFlow
        </a>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Brain size={20} className="text-primary" aria-hidden /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Inteligência financeira</h1>
            <p className="text-sm text-muted-foreground">Duas ajudas automáticas do FinanceFlow. Escolha uma e teste.</p>
          </div>
        </div>
      </header>

      <div role="tablist" aria-label="Recursos" className="grid gap-2 sm:grid-cols-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)}
              className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40')}>
              <Icon size={18} className={cn('mt-0.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span className="min-w-0">
                <span className={cn('block text-sm font-semibold', active && 'text-primary')}>{t.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t.what}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground/80">{t.where}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="Como usar" className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Como usar este teste</p>
        <ol className="space-y-1.5">
          {current.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
          Aqui tudo usa dados de exemplo. Nada do que você fizer nesta página altera ou usa as suas finanças.
        </p>
      </section>

      <section aria-label="Teste interativo">
        <Suspense fallback={<LoadingState rows={3} />}>
          {tab === 'forecast' ? <ForecastLab /> : <ClassifierLab />}
        </Suspense>
      </section>
    </div>
  );
}
