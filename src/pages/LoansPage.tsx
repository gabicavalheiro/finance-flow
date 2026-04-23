import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark, Plus, Trash2, Pencil, TrendingDown,
  CalendarDays, Building2, ChevronDown, ChevronUp, Loader2,
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
import {
  Loan, getLoans, addLoan, updateLoan, deleteLoan,
} from '@/lib/store_modules';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPTY = (): Omit<Loan, 'id'> => ({
  name: '', institution: '', totalAmount: 0, remainingAmount: 0,
  interestRate: 0, installments: 1, paidInstallments: 0,
  monthlyPayment: 0, startDate: new Date().toISOString().slice(0, 10),
});

// ─── Formulário (Dialog) ──────────────────────────────────────────────────────
function LoanDialog({
  trigger, initial, onSave,
}: {
  trigger: React.ReactNode;
  initial?: Loan;
  onSave: (data: Omit<Loan, 'id'>) => Promise<void>;
}) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState(initial ?? EMPTY());

  useEffect(() => { if (open) setForm(initial ?? EMPTY()); }, [open]);

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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar empréstimo' : 'Novo empréstimo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input placeholder="Ex: Crédito pessoal" value={form.name}
              onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Instituição</Label>
            <Input placeholder="Ex: Banco do Brasil" value={form.institution}
              onChange={e => set('institution', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor total (R$)</Label>
              <Input type="number" min={0} placeholder="0,00"
                value={form.totalAmount || ''}
                onChange={e => set('totalAmount', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saldo restante (R$)</Label>
              <Input type="number" min={0} placeholder="0,00"
                value={form.remainingAmount || ''}
                onChange={e => set('remainingAmount', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Parcelas</Label>
              <Input type="number" min={1} value={form.installments}
                onChange={e => set('installments', parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parcelas pagas</Label>
              <Input type="number" min={0} value={form.paidInstallments}
                onChange={e => set('paidInstallments', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Parcela mensal (R$)</Label>
              <Input type="number" min={0} value={form.monthlyPayment || ''}
                onChange={e => set('monthlyPayment', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Juros (% a.m.)</Label>
              <Input type="number" min={0} step={0.01} value={form.interestRate || ''}
                onChange={e => set('interestRate', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de início</Label>
            <Input type="date" value={form.startDate}
              onChange={e => set('startDate', e.target.value)} />
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
function LoanCard({ loan, onEdit, onDelete }: {
  loan: Loan;
  onEdit: (l: Loan) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = loan.installments > 0
    ? (loan.paidInstallments / loan.installments) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 space-y-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'hsl(25 95% 53% / 0.12)', color: 'hsl(25 95% 53%)' }}>
          <Landmark size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{loan.name}</p>
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
          <span>{loan.paidInstallments}/{loan.installments} parcelas</span>
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
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function LoansPage() {
  const [loans, setLoans]         = useState<Loan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<Loan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setLoans(await getLoans()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalRemaining = loans.reduce((s, l) => s + l.remainingAmount, 0);
  const totalMonthly   = loans.reduce((s, l) => s + l.monthlyPayment, 0);

  const handleAdd = async (data: Omit<Loan, 'id'>) => {
    await addLoan({ ...data, id: crypto.randomUUID() });
    toast.success('Empréstimo adicionado');
    loadAll();
  };

  const handleEdit = async (data: Omit<Loan, 'id'>) => {
    if (!editing) return;
    await updateLoan({ ...data, id: editing.id });
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
                onEdit={setEditing} onDelete={setDeletingId} />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog — abre programaticamente quando editing !== null */}
      {editing && (
        <LoanDialog
          trigger={<span className="hidden" />}
          initial={editing}
          onSave={async data => { await handleEdit(data); }}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este empréstimo? Esta ação não pode ser desfeita.
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
