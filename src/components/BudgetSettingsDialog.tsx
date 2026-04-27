// src/components/BudgetSettingsDialog.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Target, Plus, Trash2, Check, Pencil, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';
import { getBudgets, upsertBudget, deleteBudget, Budget } from '@/lib/budgets';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(raw: string): number {
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Todas as categorias de gasto disponíveis
const ALL_CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
  key,
  label: cfg.label,
  color: cfg.color,
  icon:  cfg.icon,
}));

// ─── Linha de orçamento editável ───────────────────────────────────────────────
interface BudgetRowProps {
  category: string;
  label: string;
  color: string;
  amount: number;
  onSave: (amount: number) => Promise<void>;
  onDelete: () => Promise<void>;
}

function BudgetRow({ category, label, color, amount, onSave, onDelete }: BudgetRowProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState('');
  const [saving, setSaving]   = useState(false);

  function startEdit() {
    setRaw(amount > 0 ? amount.toFixed(2).replace('.', ',') : '');
    setEditing(true);
  }

  async function handleSave() {
    const parsed = parseBRL(raw);
    if (parsed <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try { await onDelete(); }
    catch { toast.error('Erro ao remover'); }
    finally { setSaving(false); }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 py-3 border-b border-border/60 last:border-0"
    >
      {/* Dot de cor */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: `hsl(${color})` }}
      />

      {/* Nome */}
      <span className="flex-1 text-sm font-medium">{label}</span>

      {/* Valor / input */}
      {editing ? (
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <input
              autoFocus
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="0,00"
              className={cn(
                'w-28 pl-8 pr-2 py-1.5 text-sm rounded-lg',
                'bg-secondary border border-border focus:border-primary outline-none',
                'text-right tabular-nums',
              )}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {amount > 0 ? fmt(amount) : '—'}
          </span>
          <button
            onClick={startEdit}
            className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Seletor de categoria para adicionar ──────────────────────────────────────
interface AddBudgetRowProps {
  existing: string[];
  onAdd: (category: string, amount: number) => Promise<void>;
}

function AddBudgetRow({ existing, onAdd }: AddBudgetRowProps) {
  const [open, setOpen]       = useState(false);
  const [category, setCat]    = useState('');
  const [raw, setRaw]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [showList, setList]   = useState(false);

  const available = ALL_CATEGORIES.filter(c => !existing.includes(c.key));
  const selected  = ALL_CATEGORIES.find(c => c.key === category);

  async function handleAdd() {
    if (!category) { toast.error('Selecione uma categoria'); return; }
    const parsed = parseBRL(raw);
    if (parsed <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    setSaving(true);
    try {
      await onAdd(category, parsed);
      setCat(''); setRaw(''); setOpen(false);
      toast.success('Orçamento adicionado!');
    } catch { toast.error('Erro ao adicionar'); }
    finally { setSaving(false); }
  }

  if (available.length === 0) return null;

  return (
    <div className="pt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'w-full flex items-center gap-2 py-2.5 px-3 rounded-xl',
            'border border-dashed border-border text-muted-foreground',
            'hover:border-primary/50 hover:text-primary hover:bg-primary/5',
            'text-sm transition-all',
          )}
        >
          <Plus size={14} /> Adicionar categoria
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary/50 rounded-xl p-3 space-y-3 border border-border"
        >
          {/* Dropdown de categoria */}
          <div className="relative">
            <button
              onClick={() => setList(v => !v)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                'bg-card border border-border text-sm',
                'hover:border-primary/50 transition-colors',
              )}
            >
              {selected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${selected.color})` }} />
                  {selected.label}
                </span>
              ) : (
                <span className="text-muted-foreground">Selecione a categoria...</span>
              )}
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            <AnimatePresence>
              {showList && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  {available.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => { setCat(cat.key); setList(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary/80 transition-colors text-left"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${cat.color})` }} />
                      {cat.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Valor */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <input
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="0,00"
              className={cn(
                'w-full pl-9 pr-3 py-2 text-sm rounded-lg',
                'bg-card border border-border focus:border-primary outline-none',
                'tabular-nums',
              )}
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !category}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
            <button
              onClick={() => { setOpen(false); setCat(''); setRaw(''); }}
              className="px-3 py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function BudgetSettingsDialog({ open, onClose, onSaved }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBudgets();
      setBudgets(data);
    } catch { toast.error('Erro ao carregar orçamentos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleSave(category: string, amount: number) {
    await upsertBudget(category, amount);
    await load();
    onSaved?.();
    toast.success('Orçamento salvo!');
  }

  async function handleDelete(category: string) {
    await deleteBudget(category);
    await load();
    onSaved?.();
    toast.success('Orçamento removido');
  }

  async function handleAdd(category: string, amount: number) {
    await upsertBudget(category, amount);
    await load();
    onSaved?.();
  }

  const existingCategories = budgets.map(b => b.category);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Wrapper de centralização */}
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className={cn(
              'w-full max-w-sm pointer-events-auto',
              'bg-card border border-white/10 rounded-2xl shadow-2xl',
              'flex flex-col max-h-[85vh]',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Target size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Orçamento Mensal</p>
                  <p className="text-[11px] text-muted-foreground">Defina limites por categoria</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/15 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Lista de orçamentos */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>
              ) : budgets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhum orçamento definido ainda.<br />Adicione abaixo!
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {budgets.map(b => {
                    const cfg = ALL_CATEGORIES.find(c => c.key === b.category);
                    return (
                      <BudgetRow
                        key={b.category}
                        category={b.category}
                        label={cfg?.label ?? b.category}
                        color={cfg?.color ?? '240 5% 55%'}
                        amount={b.amount}
                        onSave={amount => handleSave(b.category, amount)}
                        onDelete={() => handleDelete(b.category)}
                      />
                    );
                  })}
                </AnimatePresence>
              )}

              {/* Adicionar nova categoria */}
              <AddBudgetRow
                existing={existingCategories}
                onAdd={handleAdd}
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/8 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Concluído
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}