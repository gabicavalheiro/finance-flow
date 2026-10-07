// Inteligência do FinanceFlow: como o app prevê e classifica os gastos (página pública, sem login).

import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, Brain, Github } from 'lucide-react';
import { LoadingState } from '@/components/states/StateViews';
import { cn } from '@/lib/utils';

const ForecastLab   = lazy(() => import('@/features/intelligence/ForecastLab'));
const ClassifierLab = lazy(() => import('@/features/intelligence/ClassifierLab'));

const TABS = [
  { id: 'forecast', label: 'Previsão de gastos' },
  { id: 'classifier', label: 'Classificador de gastos' },
] as const;

export default function IntelligencePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('forecast');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 space-y-5">
      <header className="space-y-2">
        <a href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={12} aria-hidden /> Voltar ao FinanceFlow
        </a>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Brain size={18} className="text-primary" aria-hidden /></div>
          <div>
            <h1 className="text-xl font-bold">Inteligência financeira</h1>
            <p className="text-xs text-muted-foreground">Como o FinanceFlow prevê e classifica seus gastos, rodando ao vivo.</p>
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Em finanças pessoais as séries são curtas (poucos meses por categoria), então modelos simples e bem validados vencem os complexos.
          Aqui o motor testa vários candidatos, escolhe por backtest e <strong className="text-foreground">sempre compara com “repetir o último mês”</strong>.
          Simule diferentes padrões de gasto e veja quando o modelo ajuda e quando não.
        </p>
      </header>

      <div role="tablist" aria-label="Modelos" className="inline-flex gap-1 rounded-xl border border-border bg-secondary p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      <section aria-label="Demonstração">
        <Suspense fallback={<LoadingState rows={3} />}>
          {tab === 'forecast' ? <ForecastLab /> : <ClassifierLab />}
        </Suspense>
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <a href="https://github.com/gabicavalheiro/finance-flow" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"><Github size={12} aria-hidden /> Código no GitHub</a>
        <span>Limitações: séries curtas não aprendem sazonalidade anual de forma confiável; intervalos são heurísticos.</span>
      </footer>
    </div>
  );
}
