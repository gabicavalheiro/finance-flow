import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSpreadsheet, Download, Upload, Loader2,
  AlertTriangle, CheckCircle2, CreditCard as CardIcon, ArrowLeftRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { addExpense, addVariableTransaction, getCards } from '@/lib/store';
import { getCustomCategories } from '@/lib/customCategories';
import { CreditCard } from '@/lib/types';
import {
  generateImportTemplate, readSpreadsheetRows, buildImportRows, ParsedImportRow,
} from '@/lib/importTransactions';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}

type Step = 'start' | 'preview' | 'importing' | 'done';

export default function ImportSpreadsheetDialog({ open, onOpenChange, onAdded }: Props) {
  const [step, setStep]           = useState<Step>('start');
  const [loadingFile, setLoadingFile] = useState(false);
  const [rows, setRows]           = useState<ParsedImportRow[]>([]);
  const [included, setIncluded]   = useState<Set<number>>(new Set());
  const [fileName, setFileName]   = useState('');
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('start'); setRows([]); setIncluded(new Set());
    setFileName(''); setProgress(0); setResult({ ok: 0, fail: 0 });
    setLoadingFile(false);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  };

  const handleDownloadTemplate = async () => {
    try {
      const cards = await getCards();
      generateImportTemplate(cards);
    } catch {
      toast.error('Erro ao gerar modelo');
    }
  };

  const handleFileSelected = async (file: File) => {
    setLoadingFile(true);
    setFileName(file.name);
    try {
      const [rawRows, cards, customCats] = await Promise.all([
        readSpreadsheetRows(file),
        getCards(),
        getCustomCategories(),
      ]);
      if (rawRows.length === 0) {
        toast.error('Planilha vazia ou em formato não reconhecido');
        setLoadingFile(false);
        return;
      }
      const parsed = buildImportRows(rawRows, cards, customCats);
      setRows(parsed);
      setIncluded(new Set(parsed.filter(r => r.errors.length === 0).map(r => r.rowNumber)));
      setStep('preview');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível ler o arquivo. Verifique o formato (.xlsx ou .csv).');
    }
    setLoadingFile(false);
  };

  const toggleRow = (rowNumber: number) => {
    setIncluded(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber); else next.add(rowNumber);
      return next;
    });
  };

  const validRows   = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);
  const selectedCount = rows.filter(r => included.has(r.rowNumber)).length;

  const handleImport = async () => {
    const toImport = rows.filter(r => included.has(r.rowNumber) && r.errors.length === 0);
    if (toImport.length === 0) {
      toast.error('Selecione ao menos um lançamento válido');
      return;
    }
    setStep('importing');
    let ok = 0, fail = 0;
    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        if (row.kind === 'variable' && row.transaction) {
          await addVariableTransaction(row.transaction);
        } else if (row.kind === 'card' && row.expense) {
          await addExpense(row.expense);
        } else {
          throw new Error('linha inválida');
        }
        ok++;
      } catch (err) {
        console.error('Falha ao importar linha', row.rowNumber, err);
        fail++;
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }
    setResult({ ok, fail });
    setStep('done');
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg rounded-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-primary" />
              Importar gastos de planilha
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ── Passo 1: instruções + upload ───────────────────────────────── */}
        {step === 'start' && (
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <p className="text-sm text-muted-foreground">
              Baixe o modelo, preencha com seus lançamentos (gastos variáveis, receitas ou compras no cartão)
              e envie de volta para importar tudo de uma vez.
            </p>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left hover:border-primary/50 hover:bg-secondary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Baixar modelo (.xlsx)</p>
                <p className="text-xs text-muted-foreground">Colunas prontas + lista de categorias e cartões</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingFile}
              className="w-full flex items-center gap-3 rounded-2xl border border-border bg-secondary p-4 text-left hover:bg-secondary/70 transition-colors disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
                {loadingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{loadingFile ? 'Lendo arquivo...' : 'Enviar planilha preenchida'}</p>
                <p className="text-xs text-muted-foreground truncate">{fileName || 'Aceita .xlsx, .xls ou .csv'}</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* ── Passo 2: pré-visualização ───────────────────────────────────── */}
        {step === 'preview' && (
          <>
            <div className="px-6 pt-4 pb-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              {validRows.length} válidos
              {invalidRows.length > 0 && (
                <>
                  <span className="mx-1">·</span>
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                  {invalidRows.length} com erro (não serão importados)
                </>
              )}
            </div>

            <div className="px-3 py-3 space-y-1.5 overflow-y-auto flex-1">
              {rows.map(row => {
                const hasError = row.errors.length > 0;
                const isChecked = included.has(row.rowNumber);
                return (
                  <div
                    key={row.rowNumber}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-3 py-2.5 border',
                      hasError ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 bg-secondary/40',
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={isChecked}
                      disabled={hasError}
                      onCheckedChange={() => toggleRow(row.rowNumber)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {row.kind === 'card'
                          ? <CardIcon size={11} className="text-muted-foreground shrink-0" />
                          : <ArrowLeftRight size={11} className="text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium truncate">{row.name || `Linha ${row.rowNumber}`}</span>
                        <span className="text-[10px] text-muted-foreground">· {row.categoryLabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Linha {row.rowNumber}
                        {row.date && ` · ${row.date.split('-').reverse().join('/')}`}
                        {row.amount !== null && ` · ${formatCurrency(row.amount)}`}
                      </p>
                      {row.errors.map((e, i) => (
                        <p key={i} className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                          <AlertTriangle size={10} /> {e}
                        </p>
                      ))}
                      {row.warnings.map((w, i) => (
                        <p key={i} className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                          <AlertTriangle size={10} /> {w}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                Voltar
              </Button>
              <Button
                className="flex-1 h-11 rounded-2xl font-semibold text-sm text-white"
                style={{ background: 'hsl(0 72% 51%)' }}
                disabled={selectedCount === 0}
                onClick={handleImport}
              >
                Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
              </Button>
            </div>
          </>
        )}

        {/* ── Passo 3: importando ─────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="px-6 py-10 flex flex-col items-center justify-center gap-4 flex-1">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando lançamentos... {progress}%</p>
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Passo 4: concluído ──────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="px-6 py-8 flex flex-col items-center justify-center gap-3 flex-1 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold">
              {result.ok} lançamento{result.ok === 1 ? '' : 's'} importado{result.ok === 1 ? '' : 's'}
            </p>
            {result.fail > 0 && (
              <p className="text-xs text-destructive">{result.fail} falharam ao salvar — tente novamente</p>
            )}
            <Button className="w-full h-11 rounded-2xl mt-2" onClick={() => handleClose(false)}>
              Concluir
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
