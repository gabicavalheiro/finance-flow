// Diálogo de unificação: escolhe o destino, mostra o que vai mudar e aplica.
// Também serve para excluir uma categoria personalizada que está em uso (mode="delete"):
// os lançamentos vão para o destino escolhido e a categoria é apagada.

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CategoryIcon from '@/components/CategoryIcon';
import { applyMergePlan } from '@/lib/categoryAdmin';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  COLLECTION_LABELS, fitsKind, normalizeLabel, planMerge, usageOf,
  type CategoryCollection, type CategoryData, type CategoryItem, type CategoryKind, type CategoryUsage,
} from '../logic';

export interface MergeRequest {
  sourceIds: string[];
  mode: 'merge' | 'delete';
  initialTargetId?: string;
}

interface Props {
  request: MergeRequest | null;
  kind: CategoryKind;
  items: CategoryItem[];
  usage: Map<string, CategoryUsage>;
  data: CategoryData;
  onClose: () => void;
  onDone: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function MergeDialog({ request, kind, items, usage, data, onClose, onDone }: Props) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setTargetId(request?.initialTargetId ?? null);
    setSearch('');
  }, [request]);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const isDelete = request?.mode === 'delete';

  // Origens visíveis = pedidas menos o destino escolhido
  const sources = useMemo(
    () => (request?.sourceIds ?? []).filter(id => id !== targetId).map(id => byId.get(id)).filter(Boolean) as CategoryItem[],
    [request, targetId, byId],
  );

  const candidates = useMemo(() => {
    const q = normalizeLabel(search);
    const blocked = new Set(isDelete || (request?.sourceIds.length ?? 0) === 1 ? request?.sourceIds : []);
    return items
      .filter(i => i.origin !== 'orphan' && !blocked.has(i.id) && fitsKind(i.scope, kind))
      .filter(i => !q || normalizeLabel(i.label).includes(q))
      .sort((a, b) => {
        // categorias do pedido (ex.: grupo de duplicadas) primeiro, depois personalizadas
        const inReq = (x: CategoryItem) => (request?.sourceIds.includes(x.id) ? 0 : 1);
        return inReq(a) - inReq(b) || (a.origin === 'custom' ? 0 : 1) - (b.origin === 'custom' ? 0 : 1);
      });
  }, [items, kind, search, isDelete, request]);

  const result = useMemo(
    () => (request && targetId ? planMerge(data, items, request.sourceIds, targetId) : null),
    [request, targetId, data, items],
  );

  const target = targetId ? byId.get(targetId) : undefined;
  const plan = result?.ok ? result.plan ?? null : null;

  const breakdown = plan
    ? (Object.keys(COLLECTION_LABELS) as CategoryCollection[])
        .filter(c => plan.counts[c] > 0)
        .map(c => plural(plan.counts[c], ...COLLECTION_LABELS[c]))
        .join(', ')
    : '';

  const confirm = async () => {
    if (!plan || !target) return;
    setSaving(true);
    try {
      const moved = await applyMergePlan(plan);
      toast.success(
        isDelete
          ? `Categoria excluída — ${plural(moved, 'lançamento movido', 'lançamentos movidos')} para "${target.label}"`
          : `Unificado em "${target.label}" — ${plural(moved, 'lançamento movido', 'lançamentos movidos')}`,
      );
      onDone();
    } catch (err) {
      console.error('applyMergePlan:', err);
      toast.error('Não foi possível concluir. Nada se perde: tente de novo para terminar.');
    } finally {
      setSaving(false);
    }
  };

  const label = (id: string) => byId.get(id)?.label ?? id;

  return (
    <Dialog open={!!request} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent
        className="bg-card border-border max-w-md max-h-[90dvh] overflow-y-auto"
        // não foca a busca ao abrir — no celular isso sobe o teclado e cobre a lista
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isDelete ? `Excluir "${sources[0]?.label ?? ''}"` : 'Unificar categorias'}</DialogTitle>
          <DialogDescription className="text-xs">
            {isDelete
              ? 'Essa categoria tem lançamentos. Escolha para onde eles vão antes de excluir.'
              : 'Os lançamentos das categorias abaixo passam para a categoria de destino.'}
          </DialogDescription>
        </DialogHeader>

        {/* Origens */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {isDelete ? 'Categoria' : 'Unificar'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sources.length === 0 && (
              <p className="text-xs text-muted-foreground">Escolha um destino diferente das categorias do grupo.</p>
            )}
            {sources.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary pl-1 pr-2.5 py-1 text-xs">
                <CategoryIcon category={s.id} size={11} />
                <span className={cn('font-medium', s.origin === 'orphan' && 'italic')}>{s.label}</span>
                <span className="text-muted-foreground">· {usageOf(usage, s.id).count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Destino */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <ArrowRight size={11} /> Para
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar categoria"
              className="pl-8 h-9 bg-secondary border-border text-sm"
            />
          </div>
          <div role="radiogroup" aria-label="Categoria de destino"
            className="max-h-52 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {candidates.length === 0 && (
              <p className="px-3 py-4 text-xs text-center text-muted-foreground">Nenhuma categoria encontrada</p>
            )}
            {candidates.map(c => {
              const active = c.id === targetId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTargetId(c.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-primary/10' : 'hover:bg-secondary/60',
                  )}
                >
                  <CategoryIcon category={c.id} size={13} />
                  <span className="flex-1 min-w-0 truncate text-sm">{c.label}</span>
                  {c.origin === 'standard' && <span className="text-[10px] text-muted-foreground">padrão</span>}
                  <span className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                    active ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                  )}>
                    {active && <Check size={10} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* O que vai acontecer */}
        {result && !result.ok && (
          <p className="flex gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertTriangle size={14} className="shrink-0 mt-px" /> {result.error}
          </p>
        )}
        {plan && target && (
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-xs space-y-1.5 leading-relaxed">
            <p>
              <strong>{plural(plan.counts.total, 'lançamento vai', 'lançamentos vão')}</strong> para "{target.label}"
              {breakdown && <span className="text-muted-foreground"> ({breakdown})</span>}.
            </p>
            {plan.budget && (
              <p>Orçamentos somados: "{target.label}" fica com <strong>{formatCurrency(plan.budget.amount)}</strong> por mês.</p>
            )}
            {plan.widenTarget && <p>"{target.label}" passa a valer para gastos e ganhos.</p>}
            {plan.deleteCustomIds.length > 0 && (
              <p>{plan.deleteCustomIds.length === 1 ? 'Será excluída' : 'Serão excluídas'}: {plan.deleteCustomIds.map(label).join(', ')}.</p>
            )}
            {plan.keptStandardIds.length > 0 && (
              <p className="text-muted-foreground">
                {plan.keptStandardIds.map(label).join(', ')}{' '}
                {plan.keptStandardIds.length === 1
                  ? 'é padrão do app: continua disponível, só fica sem lançamentos.'
                  : 'são padrão do app: continuam disponíveis, só ficam sem lançamentos.'}
              </p>
            )}
            {plan.mlRelabel && (
              <p className="text-muted-foreground">O Classificador de gastos também passa a usar "{target.label}".</p>
            )}
            <p className="text-muted-foreground">Essa ação não pode ser desfeita.</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            className="flex-1"
            variant={isDelete ? 'destructive' : 'default'}
            disabled={!plan || saving}
            onClick={confirm}
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {isDelete ? 'Mover e excluir' : 'Unificar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
