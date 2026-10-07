// Inteligência do FinanceFlow: como o app prevê e classifica os gastos (página pública, sem login).

import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import { LoadingState } from '@/components/states/StateViews';
import { cn } from '@/lib/utils';

const ForecastLab   = lazy(() => import('@/features/intelligence/ForecastLab'));
const ClassifierLab = lazy(() => import('@/features/intelligence/ClassifierLab'));

const TABS = [
  { id: 'forecast', label: 'Previsão de gastos' },
  { id: 'classifier', label: 'Categoria automática' },
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
            <p className="text-xs text-muted-foreground">Veja como o FinanceFlow prevê e organiza seus gastos.</p>
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          O FinanceFlow olha seus gastos dos meses anteriores para estimar quanto você vai gastar nos próximos
          e para sugerir a categoria de cada compra. Aqui você pode testar como isso funciona, com dados de exemplo.
          Para saber se a previsão realmente ajuda, ela é sempre comparada com a conta mais simples:
          <strong className="text-foreground"> supor que o próximo mês será igual ao último</strong>.
        </p>
      </header>

      <div role="tablist" aria-label="Seções" className="inline-flex gap-1 rounded-xl border border-border bg-secondary p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      <section aria-label="Teste interativo">
        <Suspense fallback={<LoadingState rows={3} />}>
          {tab === 'forecast' ? <ForecastLab /> : <ClassifierLab />}
        </Suspense>
      </section>
    </div>
  );
}
