// src/pages/SubscriptionsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, CheckCircle2, Circle,
  Repeat2, Pause, Play, ExternalLink,
  ChevronDown, ChevronUp, Loader2,
  CreditCard as CreditCardIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, generateId, getCurrentMonth } from '@/lib/helpers';
import {
  Subscription, SUBSCRIPTION_CATEGORIES, BillingCycle,
  getSubscriptions, addSubscription, updateSubscription,
  deleteSubscription, toggleSubscriptionPaid, toggleSubscriptionActive,
  monthlyAmount,
} from '@/lib/subscriptions';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  annual:  'Anual',
};

const POPULAR_ICONS = [
  '🎬', '🎵', '☁️', '💻', '🎮', '📰', '🏋️', '📚', '🔒', '📺',
  '🎧', '🛡️', '📦', '🌐', '✉️', '🗺️', '🔑', '🎙️', '📱', '⚡',
];

// ─── Form types ───────────────────────────────────────────────────────────────

interface FormState {
  name:         string;
  amount:       number;
  billingCycle: BillingCycle;
  billingDay:   number;
  category:     string;
  icon:         string;
  url:          string;
  notes:        string;
  cardId:       string;
}

const EMPTY_FORM: FormState = {
  name: '', amount: 0, billingCycle: 'monthly',
  billingDay: 1, category: 'streaming', icon: '📦',
  url: '', notes: '', cardId: '',
};

// ─── FormDialog ───────────────────────────────────────────────────────────────

interface FormDialogProps {
  open:     boolean;
  editing?: Subscription;
  onClose:  () => void;
  onSaved:  () => void;
}

function FormDialog({ open, editing, onClose, onSaved }: FormDialogProps) {
  const { cards } = useFinanceData();
  const [form,   setForm]   = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        name:         editing.name,
        amount:       editing.amount,
        billingCycle: editing.billingCycle,
        billingDay:   editing.billingDay,
        category:     editing.category,
        icon:         editing.icon ?? '📦',
        url:          editing.url ?? '',
        notes:        editing.notes ?? '',
        cardId:       editing.cardId ?? '',
      } : EMPTY_FORM);
    }
  }, [open, editing]);

  // Função nomeada — evita ambiguidade <K extends> com JSX em .tsx
  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    if (form.amount <= 0)  { toast.error('Valor deve ser maior que zero'); return; }
    setSaving(true);
    try {
      const sub: Subscription = {
        id:           editing?.id ?? generateId(),
        name:         form.name.trim(),
        amount:       form.amount,
        billingCycle: form.billingCycle,
        billingDay:   form.billingDay,
        category:     form.category,
        active:       editing?.active ?? true,
        paidMonths:   editing?.paidMonths ?? [],
        cardId:       form.cardId || undefined,
        icon:         form.icon  || undefined,
        url:          form.url.trim()   || undefined,
        notes:        form.notes.trim() || undefined,
      };
      if (editing) {
        await updateSubscription(sub);
        toast.success('Assinatura atualizada!');
      } else {
        await addSubscription(sub);
        toast.success('Assinatura adicionada!');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Erro ao salvar assinatura');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? 'Editar assinatura' : 'Nova assinatura'}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Ícone */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Ícone</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setField('icon', ic)}
                  className={cn(
                    'w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border',
                    form.icon === ic
                      ? 'bg-primary/20 border-primary'
                      : 'bg-secondary border-transparent hover:bg-primary/10',
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Ex: Netflix, Spotify..."
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput
              value={form.amount > 0 ? String(form.amount) : ''}
              onChange={raw => setField('amount', raw ? parseFloat(raw) : 0)}
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Ciclo + Dia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ciclo</Label>
              <Select
                value={form.billingCycle}
                onValueChange={v => setField('billingCycle', v as BillingCycle)}
              >
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia da cobrança</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.billingDay}
                onChange={e => setField('billingDay', Math.max(1, Math.min(31, Number(e.target.value))))}
                className="bg-secondary border-border rounded-xl h-11"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={form.category} onValueChange={v => setField('category', v)}>
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cartão */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cartão de cobrança</Label>
            <Select
              value={form.cardId || 'none'}
              onValueChange={v => setField('cardId', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Nenhum (débito / PIX)</span>
                </SelectItem>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CreditCardIcon size={13} />
                      {c.name} •••• {c.lastDigits}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Site (opcional)</Label>
            <Input
              value={form.url}
              onChange={e => setField('url', e.target.value)}
              placeholder="https://netflix.com"
              type="url"
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
            <Input
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Compartilhado com a família..."
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SubCard ──────────────────────────────────────────────────────────────────

interface SubCardProps {
  sub:            Subscription;
  month:          string;
  cardName?:      string;
  onEdit:         (s: Subscription) => void;
  onDelete:       (s: Subscription) => void;
  onTogglePaid:   (s: Subscription) => void;
  onToggleActive: (s: Subscription) => void;
  loadingId:      string | null;
}

function SubCard({
  sub, month, cardName,
  onEdit, onDelete, onTogglePaid, onToggleActive, loadingId,
}: SubCardProps) {
  const isPaid    = sub.paidMonths.includes(month);
  const isLoading = loadingId === sub.id;
  const monthly   = monthlyAmount(sub);
  const catInfo   = SUBSCRIPTION_CATEGORIES.find(c => c.value === sub.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-2xl border transition-all',
        sub.active ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-60',
      )}
    >
      {/* Ícone */}
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0',
        sub.active ? 'bg-primary/10' : 'bg-muted',
      )}>
        {sub.icon ?? catInfo?.emoji ?? '📦'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-semibold truncate', !sub.active && 'text-muted-foreground')}>
            {sub.name}
          </p>
          {!sub.active && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
              Pausada
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {catInfo?.emoji} {catInfo?.label}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground">
            Dia {sub.billingDay} · {CYCLE_LABELS[sub.billingCycle]}
          </span>
          {cardName && (
            <React.Fragment>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CreditCardIcon size={10} />
                {cardName}
              </span>
            </React.Fragment>
          )}
          {sub.url && (
            <React.Fragment>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <a
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
              </a>
            </React.Fragment>
          )}
        </div>
      </div>

      {/* Valor */}
      <div className="text-right shrink-0">
        <p className={cn(
          'text-sm font-bold tabular-nums',
          sub.active ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {formatCurrency(monthly)}/mês
        </p>
        {sub.billingCycle === 'annual' && (
          <p className="text-[10px] text-muted-foreground">{formatCurrency(sub.amount)}/ano</p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        {sub.active && (
          <button
            onClick={() => onTogglePaid(sub)}
            disabled={!!isLoading}
            title={isPaid ? 'Desmarcar pagamento' : 'Marcar como pago'}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              isPaid
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary',
            )}
          >
            {isLoading
              ? <Loader2 size={14} className="animate-spin" />
              : isPaid ? <CheckCircle2 size={14} /> : <Circle size={14} />
            }
          </button>
        )}

        <button
          onClick={() => onToggleActive(sub)}
          disabled={!!isLoading}
          title={sub.active ? 'Pausar' : 'Retomar'}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-amber-500/10 hover:text-amber-400 transition-all"
        >
          {sub.active ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          onClick={() => onEdit(sub)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
        >
          <Pencil size={14} />
        </button>

        <button
          onClick={() => onDelete(sub)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { cards } = useFinanceData();
  const [subs,       setSubs]       = useState<Subscription[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [month]                     = useState(getCurrentMonth());
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Subscription | undefined>();
  const [toDelete,   setToDelete]   = useState<Subscription | null>(null);
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  const [showPaused, setShowPaused] = useState(false);

  const cardMap = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);

  const load = useCallback(async () => {
    setLoading(true);
    setSubs(await getSubscriptions());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => subs.filter(s => s.active),  [subs]);
  const paused = useMemo(() => subs.filter(s => !s.active), [subs]);

  const totalMonthly = useMemo(
    () => active.reduce((sum, s) => sum + monthlyAmount(s), 0),
    [active],
  );
  const totalAnnual = useMemo(
    () => active.reduce((sum, s) => sum + (s.billingCycle === 'annual' ? s.amount : s.amount * 12), 0),
    [active],
  );
  const paidThisMonth = useMemo(
    () => active.filter(s => s.paidMonths.includes(month)).length,
    [active, month],
  );
  const unpaidAmount = useMemo(
    () => active
      .filter(s => !s.paidMonths.includes(month))
      .reduce((sum, s) => sum + monthlyAmount(s), 0),
    [active, month],
  );

  const handleEdit   = (s: Subscription) => { setEditing(s); setFormOpen(true); };
  const handleAddNew = () => { setEditing(undefined); setFormOpen(true); };

  const handleTogglePaid = async (sub: Subscription) => {
    setLoadingId(sub.id);
    try {
      await toggleSubscriptionPaid(sub, month);
      setSubs(prev => prev.map(s =>
        s.id !== sub.id ? s : {
          ...s,
          paidMonths: s.paidMonths.includes(month)
            ? s.paidMonths.filter(m => m !== month)
            : [...s.paidMonths, month],
        },
      ));
      toast.success(sub.paidMonths.includes(month) ? 'Desmarcado' : `${sub.name} paga!`);
    } catch {
      toast.error('Erro ao atualizar');
      load();
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleActive = async (sub: Subscription) => {
    setLoadingId(sub.id);
    try {
      const newActive = !sub.active;
      await toggleSubscriptionActive(sub.id, newActive);
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, active: newActive } : s));
      toast.success(newActive ? `${sub.name} reativada` : `${sub.name} pausada`);
    } catch {
      toast.error('Erro ao atualizar');
      load();
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteSubscription(toDelete.id);
      setSubs(prev => prev.filter(s => s.id !== toDelete.id));
      toast.success(`${toDelete.name} removida`);
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setToDelete(null);
    }
  };

  function renderCards(list: Subscription[]) {
    return list.map(sub => (
      <SubCard
        key={sub.id}
        sub={sub}
        month={month}
        cardName={sub.cardId ? cardMap.get(sub.cardId)?.name : undefined}
        onEdit={handleEdit}
        onDelete={setToDelete}
        onTogglePaid={handleTogglePaid}
        onToggleActive={handleToggleActive}
        loadingId={loadingId}
      />
    ));
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8 pt-6 px-4 md:px-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Repeat2 size={22} className="text-primary" />
            Assinaturas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recorrências automáticas todo mês
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          size="sm"
          className="gap-2 text-white"
          style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
        >
          <Plus size={16} />
          Nova
        </Button>
      </div>

      {/* Resumo */}
      {!loading && active.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Mensal</p>
            <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(totalMonthly)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Anual</p>
            <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(totalAnnual)}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-4 border',
            paidThisMonth === active.length
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-card border-border',
          )}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pagas</p>
            <p className={cn(
              'text-lg font-bold mt-1',
              paidThisMonth === active.length ? 'text-emerald-400' : 'text-foreground',
            )}>
              {paidThisMonth}/{active.length}
            </p>
          </div>
        </div>
      )}

      {/* Alerta pendentes */}
      {!loading && unpaidAmount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <Circle size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {formatCurrency(unpaidAmount)} ainda a pagar este mês
            </p>
            <p className="text-xs text-muted-foreground">
              {active.filter(s => !s.paidMonths.includes(month)).length} assinatura(s) pendente(s)
            </p>
          </div>
        </div>
      )}

      {/* Lista ativa */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-muted-foreground font-medium">Nenhuma assinatura cadastrada</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Adicione suas assinaturas recorrentes para controlá-las aqui
          </p>
          <Button
            onClick={handleAddNew}
            className="mt-4 gap-2 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            <Plus size={16} /> Adicionar assinatura
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {renderCards(active)}
          </AnimatePresence>
        </div>
      )}

      {/* Pausadas */}
      {paused.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowPaused(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showPaused ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {paused.length} assinatura{paused.length > 1 ? 's' : ''} pausada{paused.length > 1 ? 's' : ''}
          </button>
          <AnimatePresence>
            {showPaused && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2.5 overflow-hidden"
              >
                {renderCards(paused)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Form dialog */}
      <FormDialog
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(undefined); }}
        onSaved={load}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}>
        <AlertDialogContent className="bg-card border-border max-w-xs rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{toDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}