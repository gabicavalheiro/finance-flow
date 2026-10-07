// Classificador inteligente de gastos — importa extrato CSV, classifica com um modelo
// TF-IDF + regressão logística (treinado no navegador) e aprende com as correções.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Upload, Send, Loader2, RefreshCw, Trash2, Search, Table2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { formatCurrency, generateId } from '@/lib/helpers';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { getVariableTransactions, addVariableTransaction } from '@/lib/store';
import { CATEGORY_CONFIG, type ExpenseCategory } from '@/lib/types';
import type { TextClassifier } from '@/lib/ml/classifier';
import { trainClassifier, classify, REVIEW_THRESHOLD, type UserExample } from '@/lib/ml/model';
import { normalize } from '@/lib/ml/text';
import {
  getMlTransactions, addMlTransactions, updateMlTransactions, deleteAllMlTransactions,
  getMlExamples, saveMlExample, type MlTransaction,
} from '@/lib/ml/store';
import { CategoryBars, PeriodColumns, type ChartDatum } from '@/components/classifier/Charts';
import ImportDialog, { type ReviewRow } from '@/components/classifier/ImportDialog';

const CATEGORIES = (Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).filter((c) => c !== 'pix_credit');
const catLabel = (c: string) => CATEGORY_CONFIG[c as ExpenseCategory]?.label ?? c;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const PAGE = 40;
const selectCls =
  'h-9 rounded-md border border-border bg-secondary px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Treina fora do primeiro paint, para o spinner aparecer antes do cálculo. */
const trainAsync = (examples: UserExample[]) =>
  new Promise<TextClassifier>((resolve) => setTimeout(() => resolve(trainClassifier(examples)), 30));

function sumBy(list: MlTransaction[], key: (t: MlTransaction) => string): ChartDatum[] {
  const m = new Map<string, number>();
  for (const t of list) m.set(key(t), (m.get(key(t)) ?? 0) + t.amount);
  return [...m.entries()].map(([k, total]) => ({ key: k, label: k, total }));
}

export default function ExpenseClassifierPage() {
  const [txs, setTxs] = useState<MlTransaction[]>([]);
  const [examples, setExamples] = useState<UserExample[]>([]);
  const [model, setModel] = useState<TextClassifier | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [probe, setProbe] = useState('');
  const { refresh: refreshApp } = useFinanceData();
  const modelRef = useRef<TextClassifier | null>(null);
  modelRef.current = model;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, e] = await Promise.all([getMlTransactions(), getMlExamples()]);
        if (!alive) return;
        setTxs(t); setExamples(e);
        const m = await trainAsync(e);
        if (alive) setModel(m);
      } catch {
        toast.error('Não foi possível carregar o classificador.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── ações ──────────────────────────────────────────────────────────────────
  /** Lança as transações como gastos variáveis do app (pulando as que já existem lá). */
  const sendToApp = useCallback(async (list: MlTransaction[]) => {
    const have = new Map<string, number>();
    try {
      for (const v of await getVariableTransactions()) {
        const k = `${v.date}|${normalize(v.name)}|${v.amount.toFixed(2)}`;
        have.set(k, (have.get(k) ?? 0) + 1);
      }
    } catch {
      toast.error('Não foi possível ler os gastos do app.');
      return null;
    }
    const done: string[] = [];
    let launched = 0; let skipped = 0;
    try {
      for (const t of list) {
        const k = `${t.date}|${normalize(t.description)}|${t.amount.toFixed(2)}`;
        const n = have.get(k) ?? 0;
        if (n > 0) { have.set(k, n - 1); skipped++; done.push(t.id); continue; }
        await addVariableTransaction({
          id: generateId(), name: t.description, amount: t.amount, type: 'expense',
          paymentMethod: 'other', category: t.category, date: t.date,
        });
        launched++; done.push(t.id);
      }
    } catch {
      toast.error(`Só ${launched} gastos foram lançados no app antes do erro.`);
    }
    if (done.length) {
      const ids = new Set(done);
      setTxs((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, sentToApp: true } : t)));
      await updateMlTransactions(done.map((id) => ({ id, patch: { sentToApp: true } }))).catch(() => undefined);
      await refreshApp();
    }
    return { launched, skipped };
  }, [refreshApp]);

  const [confirmSend, setConfirmSend] = useState(false);
  const doSend = async () => {
    setConfirmSend(false);
    setBusy(true);
    const r = await sendToApp(toSend);
    setBusy(false);
    if (r) toast.success(`${r.launched} gastos lançados no app${r.skipped ? ` (${r.skipped} já existiam)` : ''}.`);
  };

  const handleImport = useCallback(async (picked: ReviewRow[], alsoApp: boolean) => {
    const rows = picked.map((r) => ({
      date: r.date, description: r.description, amount: r.amount, category: r.category,
      confidence: r.edited ? 1 : r.confidence,
      source: (r.edited ? 'user' : 'model') as 'user' | 'model',
    }));
    let added: MlTransaction[]; let duplicates: number;
    try {
      ({ added, duplicates } = await addMlTransactions(rows, txs));
    } catch {
      toast.error('Não foi possível salvar as transações.');
      throw new Error('import');
    }
    setTxs((prev) => [...added, ...prev].sort((a, b) => b.date.localeCompare(a.date)));

    // categorias corrigidas na revisão viram exemplos de treino
    const corrected = picked.filter((r) => r.edited);
    if (corrected.length) {
      const keys = new Set(corrected.map((r) => normalize(r.description)));
      setExamples((prev) => [
        ...prev.filter((e) => !keys.has(normalize(e.text))),
        ...corrected.map((r) => ({ text: r.description, label: r.category })),
      ]);
      setPending((n) => n + corrected.length);
      Promise.all(corrected.map((r) => saveMlExample(r.description, r.category))).catch(() => toast.error('Algumas correções não foram salvas.'));
    }

    let appMsg = '';
    if (alsoApp) {
      const r = await sendToApp(added);
      appMsg = r ? ` · ${r.launched} lançadas nos gastos do app${r.skipped ? ` (${r.skipped} já existiam)` : ''}` : '';
    }
    toast.success(`${added.length} importadas no classificador${duplicates ? ` (${duplicates} já existiam)` : ''}${appMsg}.`);
  }, [txs, sendToApp]);

  const changeCategory = async (tx: MlTransaction, next: ExpenseCategory) => {
    if (next === tx.category && tx.source === 'user') return;
    setTxs((prev) => prev.map((t) => (t.id === tx.id ? { ...t, category: next, confidence: 1, source: 'user' } : t)));
    const key = normalize(tx.description);
    setExamples((prev) => [...prev.filter((e) => normalize(e.text) !== key), { text: tx.description, label: next }]);
    setPending((n) => n + 1);
    try {
      await Promise.all([
        updateMlTransactions([{ id: tx.id, patch: { category: next, confidence: 1, source: 'user' } }]),
        saveMlExample(tx.description, next),
      ]);
    } catch {
      toast.error('Não foi possível salvar a correção.');
    }
  };

  const reprocess = async () => {
    setBusy(true);
    try {
      const m = await trainAsync(examples);
      setModel(m);
      const changes: { id: string; patch: { category: ExpenseCategory; confidence: number } }[] = [];
      let moved = 0;
      const next = txs.map((t) => {
        if (t.source === 'user') return t;
        const c = classify(m, t.description);
        if (c.category === t.category && Math.abs(c.confidence - t.confidence) < 0.005) return t;
        if (c.category !== t.category) moved++;
        changes.push({ id: t.id, patch: { category: c.category, confidence: c.confidence } });
        return { ...t, category: c.category, confidence: c.confidence };
      });
      if (changes.length) await updateMlTransactions(changes);
      setTxs(next);
      setPending(0);
      toast.success(moved ? `Reprocessado: ${moved} transações mudaram de categoria.` : 'Reprocessado: nenhuma categoria mudou.');
    } catch {
      toast.error('Não foi possível reprocessar.');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    setConfirmClear(false);
    try {
      const n = await deleteAllMlTransactions();
      setTxs([]); setPending(0); setCategory(null); setPeriod('all');
      toast.success(`${n} transações removidas. Suas correções continuam valendo para o modelo.`);
    } catch {
      toast.error('Não foi possível limpar.');
    }
  };

  // ── dados derivados ────────────────────────────────────────────────────────
  const months = useMemo(() => [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse(), [txs]);
  const q = normalize(search);
  const scoped = useMemo(
    () => txs.filter((t) => (period === 'all' || t.date.startsWith(period)) && (!q || normalize(t.description).includes(q))),
    [txs, period, q],
  );
  const filtered = useMemo(
    () => scoped.filter((t) => (!category || t.category === category)
      && (!onlyReview || (t.source === 'model' && t.confidence < REVIEW_THRESHOLD))),
    [scoped, category, onlyReview],
  );
  const total = filtered.reduce((a, t) => a + t.amount, 0);
  const reviewCount = scoped.filter((t) => t.source === 'model' && t.confidence < REVIEW_THRESHOLD).length;

  const toSend = useMemo(() => filtered.filter((t) => !t.sentToApp), [filtered]);
  const toSendTotal = toSend.reduce((a, t) => a + t.amount, 0);

  const byCategory = useMemo(
    () => sumBy(scoped, (t) => t.category).map((d) => ({ ...d, key: d.key, label: catLabel(d.key) })).sort((a, b) => b.total - a.total),
    [scoped],
  );
  const leader = useMemo(() => {
    const m = sumBy(filtered, (t) => t.category).sort((a, b) => b.total - a.total)[0];
    return m ? catLabel(m.key) : '—';
  }, [filtered]);
  const byPeriod = useMemo(() => {
    const daily = period !== 'all';
    return sumBy(filtered, (t) => (daily ? t.date : t.date.slice(0, 7)))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((d) => ({ ...d, label: daily ? d.key.slice(8) : monthLabel(d.key) }));
  }, [filtered, period]);

  const probeResult = useMemo(() => {
    if (!model || !probe.trim()) return null;
    return classify(model, probe).prediction;
  }, [model, probe]);

  useEffect(() => setShown(PAGE), [period, search, category, onlyReview]);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="pb-24 md:pb-10 max-w-3xl mx-auto">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Brain size={16} className="text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold">Classificador</h1>
            <p className="text-xs text-muted-foreground">Importe o extrato e a IA separa por categoria</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}><Upload size={14} /> Importar CSV</Button>
      </header>

      <div className="px-4 md:px-8 space-y-5">
        {/* Testar o modelo */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="probe">Testar o classificador</label>
          <Input id="probe" value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="Ex.: Uber *Trip, Netflix, Droga Raia…"
            disabled={!model} className="bg-secondary border-border" />
          {probeResult && (
            <div className="text-sm space-y-1">
              <p>
                <strong>{probe.trim()}</strong> → {probeResult.known ? <><strong>{catLabel(probeResult.label)}</strong> ({pct(probeResult.confidence)})</> : 'não reconheci essa descrição'}
              </p>
              {probeResult.known && (
                <p className="text-xs text-muted-foreground">
                  {probeResult.probabilities.slice(0, 3).map((p) => `${catLabel(p.label)} ${pct(p.p)}`).join(' · ')}
                </p>
              )}
            </div>
          )}
        </section>

        {txs.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <p className="font-medium">Nenhuma transação ainda</p>
            <p className="text-sm text-muted-foreground">Baixe o extrato do seu banco ou a fatura do cartão em CSV e importe aqui.</p>
            <Button onClick={() => setImportOpen(true)} className="gap-1.5"><Upload size={14} /> Importar CSV</Button>
          </section>
        ) : (
          <>
            {/* Filtros: uma linha acima de tudo que eles afetam */}
            <div className="flex flex-wrap items-center gap-2">
              <select className={selectCls} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
                <option value="all">Todo o período</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição" className="pl-8 h-9 bg-secondary border-border" />
              </div>
              {category && (
                <Button size="sm" variant="secondary" onClick={() => setCategory(null)}>{catLabel(category)} ✕</Button>
              )}
              <Button size="sm" variant={onlyReview ? 'default' : 'outline'} className="border-border" onClick={() => setOnlyReview((v) => !v)}>
                Revisar ({reviewCount})
              </Button>
            </div>

            {/* Números */}
            <section className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total gasto{category ? ` · ${catLabel(category)}` : ''}</p>
                <p className="text-5xl font-bold tracking-tight">{formatCurrency(total)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Transações', String(filtered.length)],
                  ['Ticket médio', formatCurrency(filtered.length ? total / filtered.length : 0)],
                  ['Maior categoria', leader],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-border bg-card px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">{l}</p>
                    <p className="text-sm font-semibold truncate">{v}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Gráficos */}
            <section className="rounded-2xl border border-border bg-card p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Gastos por categoria e período</h2>
                <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={() => setAsTable((v) => !v)}>
                  {asTable ? <><BarChart3 size={14} /> Ver gráfico</> : <><Table2 size={14} /> Ver como tabela</>}
                </Button>
              </div>
              <CategoryBars data={byCategory} selected={category} onSelect={setCategory} asTable={asTable} />
              <div>
                <p className="text-xs text-muted-foreground mb-2">{period === 'all' ? 'Por mês' : 'Por dia'}</p>
                <PeriodColumns data={byPeriod} asTable={asTable} />
              </div>
            </section>

            {/* Correções pendentes */}
            {pending > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm">{pending} {pending === 1 ? 'correção salva' : 'correções salvas'}. Reprocesse para aplicar às demais transações.</p>
                <Button size="sm" onClick={reprocess} disabled={busy} className="gap-1.5 shrink-0">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reprocessar
                </Button>
              </div>
            )}

            {/* Lista */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Transações</h2>
                <div className="flex gap-1">
                  <Button size="sm" className="gap-1.5 h-8" disabled={busy || !toSend.length} onClick={() => setConfirmSend(true)}>
                    <Send size={14} /> Enviar ao app ({toSend.length})
                  </Button>
                  {pending === 0 && (
                    <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={reprocess} disabled={busy}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reprocessar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-muted-foreground" onClick={() => setConfirmClear(true)}>
                    <Trash2 size={14} /> Limpar
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
                {filtered.slice(0, shown).map((t) => {
                  const review = t.source === 'model' && t.confidence < REVIEW_THRESHOLD;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{t.date.split('-').reverse().join('/')} · {formatCurrency(t.amount)}</p>
                      </div>
                      <span className={cn(
                        'shrink-0 text-[11px] rounded-full px-2 py-0.5',
                        t.source === 'user' ? 'bg-secondary text-muted-foreground' : review ? 'bg-amber-500/15 text-amber-500' : 'bg-primary/10 text-primary',
                      )}>
                        {t.source === 'user' ? 'manual' : review ? 'revisar' : pct(t.confidence)}
                      </span>
                      {t.sentToApp && <span className="shrink-0 text-[11px] text-muted-foreground">no app ✓</span>}
                      <select className={cn(selectCls, 'w-32 shrink-0')} value={t.category} aria-label={`Categoria de ${t.description}`}
                        onChange={(e) => changeCategory(t, e.target.value as ExpenseCategory)}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
                      </select>
                    </div>
                  );
                })}
                {!filtered.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nada com esses filtros.</p>}
              </div>
              {filtered.length > shown && (
                <Button variant="outline" className="w-full border-border" onClick={() => setShown((n) => n + PAGE)}>
                  Mostrar mais ({filtered.length - shown})
                </Button>
              )}
            </section>
          </>
        )}
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} classifyText={(d) => { const c = classify(modelRef.current ?? trainClassifier(examples), d); return { category: c.category, confidence: c.confidence }; }} onImport={handleImport} />
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar {toSend.length} gastos ao app?</AlertDialogTitle>
            <AlertDialogDescription>
              Total de {formatCurrency(toSendTotal)}, lançados como gastos variáveis na data do extrato e com a categoria atual
              (forma de pagamento "Outro"). Vale só para o que está no filtro da tela e ainda não foi enviado; lançamentos idênticos
              que já existem no app são pulados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSend}>Enviar ao app</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todas as transações?</AlertDialogTitle>
            <AlertDialogDescription>Remove as transações importadas. Suas correções continuam salvas e seguem treinando o modelo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll}>Limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
