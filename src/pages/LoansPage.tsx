import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark, Plus, Trash2, Pencil, TrendingDown,
  CalendarDays, Building2, ChevronDown, ChevronUp, Loader2, Check, PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';
import {
  Loan, getLoans, addLoan, updateLoan, deleteLoan,
} from '@/lib/store_modules';
import {
  getPaidNumbers, togglePaidInstallment, registerPaidAmount, totalPaid, isLoanSettled,
} from '@/lib/loanPayments';
import { fireConfetti, HappyFace } from '@/components/Celebration';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPTY = (): Omit<Loan, 'id'> => ({
  name: '', institution: '', totalAmount: 0, remainingAmount: 0,
  interestRate: 0, installments: 1, paidInstallments: 0,
  monthlyPayment: 0, startDate: new Date().toISOString().slice(0, 10),
});

// ─── Formulário (Dialog) ──────────────────────────────────────────────────────
// Agora aceita `open` e `onOpenChange` opcionais. Quando passados, o dialog
// fica controlado de fora (modo edição). Quando não passados, usa estado
// interno e o `trigger` é quem abre (modo criação).
function LoanDialog({
  trigger, initial, onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: React.ReactNode;
  initial?: Loan;
  onSave: (data: Omit<Loan, 'id'>) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open    = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnOpenChange?.(v);
    else              setInternalOpen(v);
  };

  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState(initial ?? EMPTY());

  // Reseta o form toda vez que abrir OU o `initial` mudar
  useEffect(() => { if (open) setForm(initial ?? EMPTY()); }, [open, initial]);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim())     { toast.error('Informe o nome do empréstimo'); return; }
    if (form.totalAmount <= 0) { toast.error('Informe o valor total'); return; }
    setSaving(true);
    try { await onSave(form); setOpen(false); }
    catch { toast.error('Erro ao salvar. Tente novamente.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar empréstimo' : 'Novo empréstimo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input placeholder="Ex: Crédito pessoal" value={form.name}
              className="bg-secondary border-border"
              onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Instituição</Label>
            <Input placeholder="Ex: Banco do Brasil" value={form.institution}
              className="bg-secondary border-border"
              onChange={e => set('institution', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor total (R$)</Label>
              <CurrencyInput
                value={form.totalAmount ? String(form.totalAmount) : ''}
                onChange={v => set('totalAmount', parseFloat(v) || 0)}
                className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saldo restante (R$)</Label>
              <CurrencyInput
                value={form.remainingAmount ? String(form.remainingAmount) : ''}
                onChange={v => set('remainingAmount', parseFloat(v) || 0)}
                className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Parcelas</Label>
              <Input type="number" min={1} value={form.installments}
                className="bg-secondary border-border"
                onChange={e => set('installments', parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parcelas pagas</Label>
              <Input type="number" min={0} value={form.paidInstallments}
                className="bg-secondary border-border"
                onChange={e => set('paidInstallments', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Parcela mensal (R$)</Label>
              <CurrencyInput
                value={form.monthlyPayment ? String(form.monthlyPayment) : ''}
                onChange={v => set('monthlyPayment', parseFloat(v) || 0)}
                className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Juros (% a.m.)</Label>
              <Input type="number" min={0} step={0.01} value={form.interestRate || ''}
                className="bg-secondary border-border"
                onChange={e => set('interestRate', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de início</Label>
            <DatePicker value={form.startDate} onChange={v => set('startDate', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de empréstimo ───────────────────────────────────────────────────────
function LoanCard({ loan, onEdit, onDelete, onUpdate }: {
  loan: Loan;
  onEdit: (l: Loan) => void;
  onDelete: (id: string) => void;
  onUpdate: (l: Loan) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [face, setFace]         = useState(0);
  const [bigFace, setBigFace]   = useState(false);
  const [amountRaw, setAmountRaw] = useState('');

  const paidSet   = getPaidNumbers(loan);
  const paidCount = paidSet.size;
  const settled   = isLoanSettled(loan);
  const progress  = loan.installments > 0
    ? Math.min(100, (paidCount / loan.installments) * 100) : 0;

  const celebrate = (x: number, y: number, finished: boolean) => {
    fireConfetti(x, y, finished ? 220 : 90);
    setBigFace(finished);
    setFace(f => f + 1);
  };

  const handleToggle = async (n: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const wasPaid = paidSet.has(n);
    const next    = togglePaidInstallment(loan, n);
    if (!wasPaid) {
      const r = e.currentTarget.getBoundingClientRect();
      const finished = isLoanSettled(next);
      celebrate(r.left + r.width / 2, r.top + r.height / 2, finished);
      toast.success(finished ? 'Empréstimo quitado! 🎉' : `Parcela ${n} paga! 😄`);
    }
    await onUpdate(next);
  };

  const handleRegisterAmount = async () => {
    const v = parseFloat(amountRaw);
    if (!(v > 0)) { toast.error('Informe um valor válido'); return; }
    const next = registerPaidAmount(loan, v);
    setAmountRaw('');
    celebrate(window.innerWidth / 2, window.innerHeight / 2, isLoanSettled(next));
    toast.success(`Pagamento de ${fmt(v)} registrado 😄`);
    await onUpdate(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-card rounded-2xl border border-border p-4 space-y-3"
    >
      <HappyFace trigger={face} big={bigFace} />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'hsl(25 95% 53% / 0.12)', color: 'hsl(25 95% 53%)' }}>
          <Landmark size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {loan.name}
            {settled && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase text-emerald-400">
                <PartyPopper size={9} />Quitado
              </span>
            )}
          </p>
          {loan.institution && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 size={10} />{loan.institution}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: 'hsl(25 95% 53%)' }}>
            {fmt(loan.remainingAmount)}
          </p>
          <p className="text-[10px] text-muted-foreground">restante</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(loan)}><Pencil size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(loan.id)}><Trash2 size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{paidCount}/{loan.installments} parcelas pagas</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: 'hsl(25 95% 53%)' }} />
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="grid grid-cols-3 gap-2 pt-1"
        >
          {[
            { label: 'Total',    value: fmt(loan.totalAmount) },
            { label: 'Parcela',  value: fmt(loan.monthlyPayment) },
            { label: 'Juros',    value: `${loan.interestRate}% a.m.` },
          ].map(item => (
            <div key={item.label} className="bg-muted/50 rounded-xl p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-semibold mt-0.5">{item.value}</p>
            </div>
          ))}
          <div className="col-span-3 flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarDays size={10} />
            Início: {loan.startDate.split('-').reverse().join('/')}
          </div>

          {/* Já pago / quanto falta */}
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Já pago</p>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">{fmt(totalPaid(loan))}</p>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'hsl(25 95% 53% / 0.1)' }}>
              <p className="text-[10px] text-muted-foreground">Falta pagar</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'hsl(25 95% 53%)' }}>
                {fmt(loan.remainingAmount)}
              </p>
            </div>
          </div>

          {/* Parcelas */}
          <div className="col-span-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Parcelas — toque para marcar como paga
            </p>
            <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-0.5 sm:grid-cols-8">
              {Array.from({ length: loan.installments }, (_, i) => i + 1).map(n => {
                const paid = paidSet.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={e => handleToggle(n, e)}
                    aria-pressed={paid}
                    aria-label={`Parcela ${n}${paid ? ' paga' : ''}`}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors',
                      paid
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {paid ? <Check size={14} /> : n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Informar valor já pago */}
          <div className="col-span-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ou informe um valor já pago
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <CurrencyInput
                  value={amountRaw}
                  onChange={v => setAmountRaw(v)}
                  className="bg-secondary border-border" />
              </div>
              <Button size="sm" onClick={handleRegisterAmount} disabled={!(parseFloat(amountRaw) > 0)}>
                Registrar
              </Button>
            </div>
            {(loan.extraPaid ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Inclui {fmt(loan.extraPaid ?? 0)} informados fora das parcelas.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function LoansPage() {
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<Loan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setLoans(await getLoans()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalRemaining = loans.reduce((s, l) => s + l.remainingAmount, 0);
  const totalMonthly   = loans.reduce((s, l) => s + l.monthlyPayment, 0);

  const handleUpdate = async (loan: Loan) => {
    setLoans(prev => prev.map(l => (l.id === loan.id ? loan : l)));
    try { await updateLoan(loan); }
    catch { toast.error('Erro ao salvar pagamento'); loadAll(); }
  };

  const handleAdd = async (data: Omit<Loan, 'id'>) => {
    // Sem saldo informado, o que falta é o total das parcelas (ou o valor total)
    const remaining = data.remainingAmount > 0
      ? data.remainingAmount
      : data.monthlyPayment > 0
        ? Math.max(0, data.monthlyPayment * (data.installments - data.paidInstallments))
        : data.totalAmount;
    await addLoan({ ...data, remainingAmount: remaining, id: crypto.randomUUID() });
    toast.success('Empréstimo adicionado');
    loadAll();
  };

  const handleEdit = async (data: Omit<Loan, 'id'>) => {
    if (!editing) return;
    // Se o nº de parcelas pagas foi editado à mão, refaz o conjunto (1..n);
    // senão mantém as parcelas marcadas, descartando as que passam do total.
    const paidChanged = data.paidInstallments !== editing.paidInstallments;
    const paidNumbers = paidChanged
      ? Array.from({ length: Math.min(data.paidInstallments, data.installments) }, (_, i) => i + 1)
      : [...getPaidNumbers(editing)].filter(n => n <= data.installments).sort((a, b) => a - b);
    await updateLoan({
      ...data, id: editing.id, paidNumbers, paidInstallments: paidNumbers.length,
    });
    toast.success('Empréstimo atualizado');
    setEditing(null);
    loadAll();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteLoan(deletingId);
      toast.success('Empréstimo removido');
      loadAll();
    } catch { toast.error('Erro ao remover'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="pb-24 md:pb-10 max-w-2xl mx-auto">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Empréstimos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Controle suas dívidas e parcelas</p>
        </div>
        <LoanDialog
          trigger={<Button size="sm" className="gap-1.5"><Plus size={14} />Novo</Button>}
          onSave={handleAdd}
        />
      </header>

      <div className="px-4 md:px-8 space-y-4">
        {/* Resumo */}
        {loans.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total em dívida</span>
              </div>
              <p className="text-lg font-bold" style={{ color: 'hsl(25 95% 53%)' }}>
                {fmt(totalRemaining)}
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Parcelas/mês</span>
              </div>
              <p className="text-lg font-bold">{fmt(totalMonthly)}</p>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Landmark size={32} strokeWidth={1.2} />
            <p className="text-sm">Nenhum empréstimo cadastrado</p>
            <LoanDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus size={14} />Adicionar empréstimo
                </Button>
              }
              onSave={handleAdd}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {loans.map(l => (
              <LoanCard key={l.id} loan={l}
                onEdit={setEditing} onDelete={setDeletingId} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog — controlado externamente por `editing` */}
      <LoanDialog
        open={!!editing}
        onOpenChange={o => { if (!o) setEditing(null); }}
        initial={editing ?? undefined}
        onSave={handleEdit}
      />

      {/* Delete dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este empréstimo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={confirmDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}