// Laboratório do classificador: digite a descrição de um gasto e veja a categoria prevista,
// a confiança e as probabilidades de todas as classes. Treina no navegador, sem login.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CATEGORY_CONFIG, type ExpenseCategory } from '@/lib/types';
import { classify, trainClassifier, REVIEW_THRESHOLD } from '@/lib/ml/model';
import { SEED_EXAMPLES } from '@/lib/ml/seedData';
import { LoadingState } from '@/components/states/StateViews';
import { cn } from '@/lib/utils';
import type { TextClassifier } from '@/lib/ml/classifier';

const SAMPLES = ['UBER *TRIP 1234', 'Padaria Pão Quente', 'Netflix.com', 'Droga Raia 0421', 'Mensalidade Smart Fit', 'Posto Ipiranga', 'PAG*MercadoLivre', 'Farmácia São João'];
const label = (c: string) => CATEGORY_CONFIG[c as ExpenseCategory]?.label ?? c;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function ClassifierLab() {
  const [model, setModel] = useState<TextClassifier | null>(null);
  const [text, setText] = useState('UBER *TRIP 1234');

  useEffect(() => {
    // treino fora do primeiro paint (leva algumas centenas de ms)
    const id = setTimeout(() => setModel(trainClassifier([])), 30);
    return () => clearTimeout(id);
  }, []);

  const result = useMemo(() => (model && text.trim() ? classify(model, text) : null), [model, text]);

  if (!model) return <LoadingState rows={3} label="Treinando o modelo no navegador…" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <label htmlFor="clf-text" className="text-sm font-semibold">Descrição do gasto</label>
        <input id="clf-text" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
          placeholder="ex.: IFOOD *RESTAURANTE"
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="flex flex-wrap gap-1.5" aria-label="Exemplos">
          {SAMPLES.map((s) => (
            <button key={s} type="button" onClick={() => setText(s)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">{s}</button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          TF-IDF (palavras + n-gramas de caracteres) com regressão logística, treinado agora no seu navegador
          com {SEED_EXAMPLES.length} exemplos. Digite uma marca que não está na lista: os n-gramas ajudam a generalizar.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-live="polite">
        {!result ? (
          <p className="text-sm text-muted-foreground">Digite uma descrição para classificar.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria prevista</p>
                <p className="text-xl font-bold">{label(result.category)}</p>
              </div>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                result.needsReview ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400')}>
                {result.needsReview ? <AlertTriangle size={12} aria-hidden /> : <CheckCircle2 size={12} aria-hidden />}
                {pct(result.confidence)} · {result.needsReview ? 'pedir revisão' : 'confiante'}
              </span>
            </div>
            {!result.prediction.known && (
              <p className="text-xs text-amber-400">Nenhum termo deste texto foi visto no treino: isto é um palpite sem base.</p>
            )}
            <ul className="space-y-1.5">
              {result.prediction.probabilities.slice(0, 5).map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between text-xs">
                    <span className={cn(p.label === result.category ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label(p.label)}</span>
                    <span className="tabular-nums text-muted-foreground">{pct(p.p)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${p.p * 100}%`, opacity: p.label === result.category ? 1 : 0.4 }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">Abaixo de {pct(REVIEW_THRESHOLD)} de confiança o app pede revisão em vez de decidir sozinho.</p>
          </>
        )}
      </div>
    </div>
  );
}
