// Importação de extrato CSV em 2 passos:
//   1) escolher o arquivo e conferir as colunas
//   2) revisar TODAS as linhas já classificadas (corrigir categoria, desmarcar o que não vale)
//      e só então confirmar a importação.
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { CATEGORY_CONFIG, type ExpenseCategory } from '@/lib/types';
import { REVIEW_THRESHOLD } from '@/lib/ml/model';
import {
  decodeCsvBuffer, parseCsv, detectColumns, buildTransactions,
  type ColumnMap, type ParsedCsv,
} from '@/lib/ml/csv';

export interface ReviewRow {
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  confidence: number;
  /** true se o usuário trocou a categoria sugerida nesta tela */
  edited: boolean;
  selected: boolean;
}

const CATEGORIES = (Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).filter((c) => c !== 'pix_credit');
const selectCls =
  'h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const br = (iso: string) => iso.split('-').reverse().join('/');

export default function ImportDialog({
  open, onOpenChange, classifyText, onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classifyText: (description: string) => { category: ExpenseCategory; confidence: number };
  /** Recebe só as linhas marcadas. `alsoApp` = lançar também nos gastos do app. */
  onImport: (rows: ReviewRow[], alsoApp: boolean) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [map, setMap] = useState<ColumnMap>({ date: 0, description: 1, amount: 2 });
  const [guessed, setGuessed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ReviewRow[] | null>(null); // != null → passo 2
  const [alsoApp, setAlsoApp] = useState(false);

  const reset = () => { setCsv(null); setRows(null); setFileName(''); setError(''); setGuessed(true); setAlsoApp(false); };

  const loadBuffer = async (getBuf: () => Promise<ArrayBuffer>, name: string) => {
    setError('');
    try {
      const parsed = parseCsv(decodeCsvBuffer(await getBuf()));
      if (parsed.rows.length === 0) { setError('Não encontrei linhas nesse arquivo.'); setCsv(null); return; }
      const found = detectColumns(parsed);
      setCsv(parsed);
      setFileName(name);
      setGuessed(found !== null);
      setMap(found ?? { date: 0, description: Math.min(1, parsed.headers.length - 1), amount: Math.min(2, parsed.headers.length - 1) });
    } catch {
      setError('Não consegui ler esse arquivo. Confira se é um CSV.');
      setCsv(null);
    }
  };
  const onFile = (file: File | undefined) => { if (file) loadBuffer(() => file.arrayBuffer(), file.name); };
  const useSample = () =>
    loadBuffer(async () => {
      const res = await fetch('/exemplos/extrato-exemplo.csv');
      if (!res.ok) throw new Error('sample');
      return res.arrayBuffer();
    }, 'extrato-exemplo.csv');

  const result = useMemo(() => (csv ? buildTransactions(csv, map) : null), [csv, map]);
  const distinct = new Set([map.date, map.description, map.amount]).size === 3;

  const goReview = () => {
    if (!result) return;
    setRows(result.expenses.map((t) => {
      const c = classifyText(t.description);
      return { ...t, category: c.category, confidence: c.confidence, edited: false, selected: true };
    }));
  };

  const patch = (i: number, p: Partial<ReviewRow>) =>
    setRows((prev) => prev && prev.map((r, k) => (k === i ? { ...r, ...p } : r)));

  const chosen = rows?.filter((r) => r.selected) ?? [];
  const chosenTotal = chosen.reduce((a, r) => a + r.amount, 0);
  const lowCount = rows?.filter((r) => !r.edited && r.confidence < REVIEW_THRESHOLD).length ?? 0;

  const submit = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try { await onImport(chosen, alsoApp); reset(); onOpenChange(false); } catch { /* a página já avisou */ } finally { setBusy(false); }
  };

  const colSelect = (label: string, key: keyof ColumnMap) => (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select className={selectCls} value={map[key]} onChange={(e) => setMap({ ...map, [key]: Number(e.target.value) })}>
        {csv!.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rows ? 'Revisar antes de importar' : 'Importar extrato (CSV)'}</DialogTitle>
          <DialogDescription>
            {rows
              ? 'Confira cada linha. Corrija a categoria ou desmarque o que não deve entrar — nada é salvo até você confirmar.'
              : 'O arquivo é lido no seu aparelho. Nada é salvo antes de você revisar e confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button variant="outline" className="gap-2 border-dashed h-12" onClick={() => fileRef.current?.click()}>
              <FileUp size={16} /> {fileName || 'Escolher arquivo CSV'}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={useSample}>
              Ou use um extrato de exemplo (40 lançamentos)
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}

            {csv && result && (
              <div className="space-y-4">
                {!guessed && (
                  <p className="text-xs text-amber-500">
                    Não consegui identificar as colunas sozinho. Escolha qual é a data, a descrição e o valor.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {colSelect('Data', 'date')}
                  {colSelect('Descrição', 'description')}
                  {colSelect('Valor', 'amount')}
                </div>
                {!distinct && <p className="text-xs text-destructive">Cada campo precisa de uma coluna diferente.</p>}
                <p className="text-xs text-muted-foreground">
                  {result.expenses.length} gastos encontrados
                  {result.skippedIncome > 0 && ` · ${result.skippedIncome} entradas ignoradas`}
                  {result.skippedInvalid > 0 && ` · ${result.skippedInvalid} linhas inválidas ignoradas`}
                </p>
                <Button className="w-full" disabled={!distinct || !result.expenses.length} onClick={goReview}>
                  Classificar e revisar
                </Button>
              </div>
            )}
          </>
        )}

        {rows && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setRows(null)}>
                <ArrowLeft size={12} /> Voltar
              </button>
              <div className="flex gap-3">
                <button type="button" className="hover:text-foreground" onClick={() => setRows(rows.map((r) => ({ ...r, selected: true })))}>Marcar todas</button>
                <button type="button" className="hover:text-foreground" onClick={() => setRows(rows.map((r) => ({ ...r, selected: false })))}>Desmarcar todas</button>
              </div>
            </div>
            {lowCount > 0 && (
              <p className="text-xs text-amber-500">{lowCount} {lowCount === 1 ? 'linha tem' : 'linhas têm'} confiança baixa (revisar) — confira a categoria.</p>
            )}

            <div className="rounded-xl border border-border divide-y divide-border/60 max-h-[48dvh] overflow-y-auto">
              {rows.map((r, i) => {
                const low = !r.edited && r.confidence < REVIEW_THRESHOLD;
                return (
                  <div key={i} className={cn('flex items-center gap-2 px-3 py-2', !r.selected && 'opacity-45')}>
                    <input type="checkbox" checked={r.selected} onChange={(e) => patch(i, { selected: e.target.checked })}
                      aria-label={`Incluir ${r.description}`} className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{br(r.date)} · {formatCurrency(r.amount)}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 text-[11px] rounded-full px-2 py-0.5',
                      r.edited ? 'bg-secondary text-muted-foreground' : low ? 'bg-amber-500/15 text-amber-500' : 'bg-primary/10 text-primary',
                    )}>
                      {r.edited ? 'manual' : low ? 'revisar' : `${Math.round(r.confidence * 100)}%`}
                    </span>
                    <select className={cn(selectCls, 'w-32 shrink-0')} value={r.category} aria-label={`Categoria de ${r.description}`}
                      onChange={(e) => patch(i, { category: e.target.value as ExpenseCategory, edited: true })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={alsoApp} onChange={(e) => setAlsoApp(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span>
                Já lançar nos meus gastos do app
                <span className="block text-xs text-muted-foreground">
                  Opcional. Você também pode enviar depois, na lista de transações, pelo botão "Enviar ao app".
                </span>
              </span>
            </label>

            <Button className="w-full gap-2" disabled={busy || !chosen.length} onClick={submit}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              Confirmar e importar {chosen.length} {chosen.length === 1 ? 'gasto' : 'gastos'} · {formatCurrency(chosenTotal)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
