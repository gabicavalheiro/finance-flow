import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Trash2, Pencil,
  Building2, CalendarDays, Wallet, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Investment, InvestmentType,
  getInvestments, addInvestment, updateInvestment, deleteInvestment,
} from '@/lib/store_modules';

// ─── Helpers visuais ──────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (invested: number, current: number) =>
  invested === 0 ? 0 : ((current - invested) / invested) * 100;

export const TYPE_LABELS: Record<InvestmentType, string> = {
  renda_fixa: 'Renda Fixa',
  acoes:      'Ações',
  fii:        'FII',
  crypto:     'Criptomoedas',
  fundo:      'Fundo',
  outro:      'Outro',
};

const TYPE_COLORS: Record<InvestmentType, string> = {
  renda_fixa: '217 91% 60%',
  acoes:      '152 69% 45%',
  fii:        '262 83% 58%',
  crypto:     '38 92% 50%',
  fundo:      '199 89% 48%',
  outro:      '215 16% 47%',
};

const EMPTY = (): Omit<Investment, 'id'> => ({
  name: '', institution: '', type: 'renda_fixa',
  amountInvested: 0, currentValue: 0,
  startDate: new Date().toISOString().slice(0, 10),
});

// ─── Formulário (Dialog) ──────────────────────────────────────────────────────
// Agora aceita `open` e `onOpenChange` opcionais para permitir controle externo
// quando em modo edição. No modo criação continua usando estado interno + trigger.
function InvestmentDialog({
  trigger, initial, onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: React.ReactNode;
  initial?: Investment;
  onSave: (data: Omit<Investment, 'id'>) => Promise<void>;
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
    if (!form.name.trim())        { toast.error('Informe o nome'); return; }
    if (form.amountInvested <= 0) { toast.error('Informe o valor investido'); return; }
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
          <DialogTitle>{initial ? 'Editar investimento' : 'Novo investimento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input placeholder="Ex: CDB Banco Inter" value={form.name}
              onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instituição</Label>
              <Input placeholder="Ex: XP" value={form.institution}
                onChange={e => set('institution', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor investido (R$)</Label>
              <Input type="number" min={0} placeholder="0,00"
                value={form.amountInvested || ''}
                onChange={e => set('amountInvested', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor atual (R$)</Label>
              <Input type="number" min={0} placeholder="0,00"
                value={form.currentValue || ''}
                onChange={e => set('currentValue', parseFloat(e.target.value) || 0)} />
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

// ─── Card de investimento ─────────────────────────────────────────────────────
function InvestmentCard({ inv, onEdit, onDelete }: {
  inv: Investment;
  onEdit: (i: Investment) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const gain     = inv.currentValue - inv.amountInvested;
  const gainPct  = pct(inv.amountInvested, inv.currentValue);
  const positive = gain >= 0;
  const color    = TYPE_COLORS[inv.type];
  const GainIcon = positive ? TrendingUp : TrendingDown;
  const gainColor = positive ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 space-y-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `hsl(${color} / 0.12)`, color: `hsl(${color})` }}>
          <TrendingUp size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{inv.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `hsl(${color} / 0.12)`, color: `hsl(${color})` }}>
            {TYPE_LABELS[inv.type]}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{fmt(inv.currentValue)}</p>
          <p className="text-[10px] flex items-center gap-0.5 justify-end" style={{ color: gainColor }}>
            <GainIcon size={10} />
            {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(inv)}><Pencil size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(inv.id)}><Trash2 size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="grid grid-cols-3 gap-2 pt-1"
        >
          {[
            { label: 'Investido',     value: fmt(inv.amountInvested) },
            { label: 'Rendimento',    value: fmt(gain),    color: gainColor },
            { label: 'Rentabilidade', value: `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%`, color: gainColor },
          ].map(item => (
            <div key={item.label} className="bg-muted/50 rounded-xl p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
          {inv.institution && (
            <div className="col-span-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 size={10} />{inv.institution}
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarDays size={10} />{inv.startDate.split('-').reverse().join('/')}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState<Investment | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setInvestments(await getInvestments()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalInvested = investments.reduce((s, i) => s + i.amountInvested, 0);
  const totalCurrent  = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalGain     = totalCurrent - totalInvested;
  const totalGainPct  = pct(totalInvested, totalCurrent);
  const gainColor     = totalGain >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';

  const handleAdd = async (data: Omit<Investment, 'id'>) => {
    await addInvestment({ ...data, id: crypto.randomUUID() });
    toast.success('Investimento adicionado');
    loadAll();
  };

  const handleEdit = async (data: Omit<Investment, 'id'>) => {
    if (!editing) return;
    await updateInvestment({ ...data, id: editing.id });
    toast.success('Investimento atualizado');
    setEditing(null);
    loadAll();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInvestment(deletingId);
      toast.success('Investimento removido');
      loadAll();
    } catch { toast.error('Erro ao remover'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="pb-24 md:pb-10 max-w-2xl mx-auto">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Investimentos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Acompanhe seu patrimônio</p>
        </div>
        <InvestmentDialog
          trigger={<Button size="sm" className="gap-1.5"><Plus size={14} />Novo</Button>}
          onSave={handleAdd}
        />
      </header>

      <div className="px-4 md:px-8 space-y-4">
        {/* Resumo */}
        {investments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Patrimônio atual</span>
              </div>
              <p className="text-xl font-bold" style={{ color: 'hsl(152 69% 45%)' }}>
                {fmt(totalCurrent)}
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Investido</span>
              </div>
              <p className="text-lg font-bold">{fmt(totalInvested)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Rendimento</p>
              <p className="text-lg font-bold" style={{ color: gainColor }}>
                {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
              </p>
              <p className="text-[10px]" style={{ color: gainColor }}>
                {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : investments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <TrendingUp size={32} strokeWidth={1.2} />
            <p className="text-sm">Nenhum investimento cadastrado</p>
            <InvestmentDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus size={14} />Adicionar investimento
                </Button>
              }
              onSave={handleAdd}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {investments.map(inv => (
              <InvestmentCard key={inv.id} inv={inv}
                onEdit={setEditing} onDelete={setDeletingId} />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog — controlado externamente por `editing` */}
      <InvestmentDialog
        open={!!editing}
        onOpenChange={o => { if (!o) setEditing(null); }}
        initial={editing ?? undefined}
        onSave={handleEdit}
      />

      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover investimento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este investimento?
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