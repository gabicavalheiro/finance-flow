// src/features/categories/logic.ts — regras do gerenciador de categorias, em funções puras.
//
// Nada aqui toca o Firestore (ver ADR 0004): recebe os dados já carregados e devolve
// listas, contagens e um "plano" de unificação. Quem grava é lib/categoryAdmin.ts.
//
// Vocabulário:
//  • categoria padrão    → as fixas do app (CATEGORY_CONFIG / INCOME_CATEGORY_CONFIG); não podem ser apagadas.
//  • personalizada       → criada pelo usuário (id "custom_…").
//  • sem cadastro        → id que aparece em lançamentos mas não existe mais (ex.: categoria
//                          personalizada apagada sem mover os lançamentos). Aparece como
//                          "Categoria removida" e pode ser unificada numa categoria válida.

import {
  CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG,
  type Expense, type FixedExpense, type FixedIncome, type VariableTransaction,
} from '@/lib/types';
import type { CustomCategory } from '@/lib/customCategories';
import type { Budget } from '@/lib/budgets';

export type CategoryKind  = 'expense' | 'income';
export type CategoryScope = CategoryKind | 'both';
export type CategoryOrigin = 'standard' | 'custom' | 'orphan';

export interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  scope: CategoryScope;
  origin: CategoryOrigin;
}

/** Coleções do Firestore que guardam a chave da categoria no campo `category`. */
export type CategoryCollection = 'expenses' | 'fixedExpenses' | 'fixedIncomes' | 'variableTransactions';

/** [singular, plural] */
export const COLLECTION_LABELS: Record<CategoryCollection, [string, string]> = {
  expenses:             ['compra no cartão', 'compras no cartão'],
  fixedExpenses:        ['gasto fixo', 'gastos fixos'],
  fixedIncomes:         ['ganho fixo', 'ganhos fixos'],
  variableTransactions: ['lançamento avulso', 'lançamentos avulsos'],
};

export interface CategoryData {
  expenses:      Pick<Expense, 'id' | 'category'>[];
  fixedExpenses: Pick<FixedExpense, 'id' | 'category'>[];
  fixedIncomes:  Pick<FixedIncome, 'id' | 'category'>[];
  variable:      Pick<VariableTransaction, 'id' | 'category' | 'type'>[];
  budgets:       Budget[];
}

export interface CategoryUsage {
  /** Total de lançamentos (cartão + fixos + ganhos fixos + avulsos). */
  count: number;
  byCollection: Record<CategoryCollection, number>;
  /** Valor do orçamento mensal da categoria, se houver. */
  budget: number | null;
  /** Em que tipo de lançamento a categoria está sendo usada de fato. */
  usedAs: { expense: boolean; income: boolean };
}

const ORPHAN_COLOR = '240 5% 55%';

// ─── Lista de categorias ─────────────────────────────────────────────────────

/** Padrões + personalizadas + ids sem cadastro encontrados nos dados. */
export function buildCategoryList(customs: CustomCategory[], data?: CategoryData): CategoryItem[] {
  const items: CategoryItem[] = [
    ...Object.entries(CATEGORY_CONFIG).map(([id, c]) => ({
      id, label: c.label, icon: c.icon, color: c.color, scope: 'expense' as const, origin: 'standard' as const,
    })),
    ...Object.entries(INCOME_CATEGORY_CONFIG).map(([id, c]) => ({
      id, label: c.label, icon: c.icon, color: c.color, scope: 'income' as const, origin: 'standard' as const,
    })),
    ...customs.map(c => ({
      id: c.id, label: c.label, icon: c.icon, color: c.color, scope: c.categoryType, origin: 'custom' as const,
    })),
  ];

  if (!data) return items;

  const known = new Set(items.map(i => i.id));
  const usage = computeUsage(data);
  usage.forEach((u, id) => {
    if (known.has(id) || !id) return;
    items.push({
      id,
      label: 'Categoria removida',
      icon: 'MoreHorizontal',
      color: ORPHAN_COLOR,
      scope: u.usedAs.expense && u.usedAs.income ? 'both' : u.usedAs.income ? 'income' : 'expense',
      origin: 'orphan',
    });
  });
  return items;
}

export function fitsKind(scope: CategoryScope, kind: CategoryKind): boolean {
  return scope === 'both' || scope === kind;
}

// ─── Uso ─────────────────────────────────────────────────────────────────────

function emptyUsage(): CategoryUsage {
  return {
    count: 0,
    byCollection: { expenses: 0, fixedExpenses: 0, fixedIncomes: 0, variableTransactions: 0 },
    budget: null,
    usedAs: { expense: false, income: false },
  };
}

/** Quantos lançamentos usam cada categoria (chave = id da categoria). */
export function computeUsage(data: CategoryData): Map<string, CategoryUsage> {
  const map = new Map<string, CategoryUsage>();
  const get = (id: string) => {
    let u = map.get(id);
    if (!u) map.set(id, (u = emptyUsage()));
    return u;
  };
  const add = (id: string | undefined, col: CategoryCollection, kind: CategoryKind) => {
    if (!id) return;
    const u = get(id);
    u.count++;
    u.byCollection[col]++;
    u.usedAs[kind] = true;
  };

  data.expenses.forEach(e => add(e.category, 'expenses', 'expense'));
  data.fixedExpenses.forEach(f => add(f.category, 'fixedExpenses', 'expense'));
  data.fixedIncomes.forEach(i => add(i.category, 'fixedIncomes', 'income'));
  data.variable.forEach(v => add(v.category, 'variableTransactions', v.type === 'income' ? 'income' : 'expense'));
  data.budgets.forEach(b => {
    if (!b.category) return;
    const u = get(b.category);
    u.budget = (u.budget ?? 0) + (Number(b.amount) || 0);
    u.usedAs.expense = true;
  });
  return map;
}

export function usageOf(usage: Map<string, CategoryUsage>, id: string): CategoryUsage {
  return usage.get(id) ?? emptyUsage();
}

// ─── Plano de unificação ─────────────────────────────────────────────────────

export interface MergePlan {
  sourceIds: string[];
  targetId: string;
  /** Documentos que terão `category` trocada para targetId. */
  updates: { collection: CategoryCollection; id: string }[];
  /** Orçamento resultante do destino (soma dos orçamentos envolvidos), se algum existir. */
  budget: { amount: number; removeIds: string[] } | null;
  /** Categorias personalizadas que deixam de existir. */
  deleteCustomIds: string[];
  /** Categorias padrão de origem: continuam no app, só ficam vazias. */
  keptStandardIds: string[];
  /** Destino personalizado que precisa passar a valer para gastos e ganhos. */
  widenTarget: boolean;
  /** Rótulos do Classificador (só categorias padrão de gasto) a renomear, ou null. */
  mlRelabel: { from: string[]; to: string } | null;
  counts: Record<CategoryCollection, number> & { total: number };
}

/** ok=true traz `plan`; ok=false traz `error` (mensagem pronta para a tela). */
export interface MergeResult { ok: boolean; plan?: MergePlan; error?: string }

export function planMerge(
  data: CategoryData,
  items: CategoryItem[],
  sourceIds: string[],
  targetId: string,
): MergeResult {
  const sources = [...new Set(sourceIds)].filter(id => id !== targetId);
  if (sources.length === 0) return { ok: false, error: 'Escolha ao menos uma categoria para unificar.' };

  const byId = new Map(items.map(i => [i.id, i]));
  const target = byId.get(targetId);
  if (!target) return { ok: false, error: 'Categoria de destino não encontrada.' };
  if (target.origin === 'orphan') return { ok: false, error: 'Escolha uma categoria existente como destino.' };

  // Que tipos de lançamento o destino vai precisar aceitar
  const usage = computeUsage(data);
  const needs = { expense: false, income: false };
  for (const id of sources) {
    const u = usageOf(usage, id);
    needs.expense ||= u.usedAs.expense;
    needs.income  ||= u.usedAs.income;
  }

  const missing: CategoryKind[] = (['expense', 'income'] as const).filter(k => needs[k] && !fitsKind(target.scope, k));
  let widenTarget = false;
  if (missing.length) {
    if (target.origin === 'custom') {
      widenTarget = true;
    } else {
      const what = missing[0] === 'income' ? 'ganhos' : 'gastos';
      return {
        ok: false,
        error: `"${target.label}" não aceita ${what}, mas há ${what} nas categorias escolhidas. Escolha outro destino.`,
      };
    }
  }

  const src = new Set(sources);
  const updates: MergePlan['updates'] = [];
  const counts = { expenses: 0, fixedExpenses: 0, fixedIncomes: 0, variableTransactions: 0, total: 0 };
  const push = (collection: CategoryCollection, id: string) => {
    updates.push({ collection, id });
    counts[collection]++;
    counts.total++;
  };
  data.expenses.forEach(e => src.has(e.category) && push('expenses', e.id));
  data.fixedExpenses.forEach(f => src.has(f.category) && push('fixedExpenses', f.id));
  data.fixedIncomes.forEach(i => src.has(i.category) && push('fixedIncomes', i.id));
  data.variable.forEach(v => src.has(v.category as string) && push('variableTransactions', v.id));

  // Orçamentos: o doc id é a própria categoria. Soma tudo no destino.
  const sourceBudgets = data.budgets.filter(b => src.has(b.category));
  let budget: MergePlan['budget'] = null;
  if (sourceBudgets.length) {
    const targetBudget = data.budgets.find(b => b.category === targetId);
    const amount = [...sourceBudgets, ...(targetBudget ? [targetBudget] : [])]
      .reduce((s, b) => s + (Number(b.amount) || 0), 0);
    budget = { amount: Math.round(amount * 100) / 100, removeIds: sourceBudgets.map(b => b.category) };
  }

  const isStdExpense = (id: string) => id in CATEGORY_CONFIG;
  const mlFrom = sources.filter(isStdExpense);
  const mlRelabel = isStdExpense(targetId) && mlFrom.length ? { from: mlFrom, to: targetId } : null;

  return {
    ok: true,
    plan: {
      sourceIds: sources,
      targetId,
      updates,
      budget,
      deleteCustomIds: sources.filter(id => byId.get(id)?.origin === 'custom'),
      keptStandardIds: sources.filter(id => byId.get(id)?.origin === 'standard'),
      widenTarget,
      mlRelabel,
      counts,
    },
  };
}

// ─── Possíveis duplicadas ────────────────────────────────────────────────────

/** minúsculas, sem acento, sem pontuação, plural simples removido. */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (/(oes|aes)$/.test(w)) return w.slice(0, -3) + 'ao';
  if (w.endsWith('ais')) return w.slice(0, -3) + 'al';
  if (w.endsWith('eis')) return w.slice(0, -3) + 'el';
  if (/(res|zes|ses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Os dois nomes parecem ser a mesma categoria? */
export function labelsLookAlike(a: string, b: string): boolean {
  const x = normalizeLabel(a).replace(/ /g, '');
  const y = normalizeLabel(b).replace(/ /g, '');
  if (!x || !y) return false;
  if (x === y) return true;

  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // "mercado" ⊂ "supermercado" — mas não "casa" ⊂ "casamento"
  if (short.length >= 5 && long.includes(short) && short.length / long.length >= 0.5) return true;

  // erro de digitação: "acdemia" ~ "academia"
  const tolerance = short.length >= 8 ? 2 : short.length >= 4 ? 1 : 0;
  return tolerance > 0 && levenshtein(x, y) <= tolerance;
}

export interface DuplicateGroup {
  ids: string[];
  /** Sugestão de destino: a categoria padrão do grupo, ou a mais usada. */
  suggestedTargetId: string;
}

/**
 * Agrupa categorias com nomes parecidos. Só sugere grupos com ao menos uma personalizada
 * (padrão x padrão nunca é duplicada) e com tipos compatíveis (gasto com gasto, ganho com ganho).
 */
export function findDuplicateGroups(
  items: CategoryItem[],
  usage: Map<string, CategoryUsage>,
): DuplicateGroup[] {
  const pool = items.filter(i => i.origin !== 'orphan');
  const parent = pool.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  const compatible = (a: CategoryItem, b: CategoryItem) =>
    a.scope === 'both' || b.scope === 'both' || a.scope === b.scope;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (a.origin === 'standard' && b.origin === 'standard') continue;
      if (!compatible(a, b)) continue;
      if (labelsLookAlike(a.label, b.label)) parent[find(j)] = find(i);
    }
  }

  const groups = new Map<number, CategoryItem[]>();
  pool.forEach((item, i) => {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(item);
    groups.set(root, g);
  });

  const result: DuplicateGroup[] = [];
  groups.forEach(g => {
    if (g.length < 2) return;
    const standard = g.find(i => i.origin === 'standard');
    const mostUsed = [...g].sort((a, b) => usageOf(usage, b.id).count - usageOf(usage, a.id).count)[0];
    result.push({ ids: g.map(i => i.id), suggestedTargetId: (standard ?? mostUsed).id });
  });
  return result;
}
