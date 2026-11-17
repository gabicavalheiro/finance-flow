// src/lib/categoryAdmin.ts — gravação do gerenciador de categorias (edição e unificação).
//
// A decisão do que muda vem pronta de features/categories/logic.ts (planMerge); aqui só
// se executa o plano no Firestore, em lotes de no máximo 400 operações (limite do
// writeBatch é 500).
//
// Ordem das escritas, pensada para uma falha no meio não deixar lixo:
//   1. troca a categoria dos lançamentos  → se parar aqui, basta unificar de novo
//   2. orçamentos e rótulos do Classificador
//   3. por último, apaga as categorias personalizadas de origem
// Assim nunca sobra lançamento apontando para uma categoria que já foi apagada.

import { getDocs, query, setDoc, where, writeBatch, type WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import { userCol, userDoc } from './firestorePaths';
import { queryCache } from './queryCache';
import { clearCustomCategoryCache, type CustomCategory } from './customCategories';
import { getExpenses, getFixedExpenses, getIncomes, getVariableTransactions } from './store';
import { getBudgets } from './budgets';
import type { CategoryData, MergePlan } from '@/features/categories/logic';

const BATCH = 400;

/** Executa operações em lotes de até BATCH escritas. */
async function inBatches<T>(items: T[], op: (batch: WriteBatch, item: T) => void): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = writeBatch(db);
    items.slice(i, i + BATCH).forEach(item => op(batch, item));
    await batch.commit();
  }
}

function invalidateFinanceCaches(): void {
  queryCache.invalidate('expenses');
  queryCache.invalidate('fixed_expenses');
  queryCache.invalidate('fixed_incomes');
  queryCache.invalidate('variable:*');
  queryCache.invalidate('variable_all');
  clearCustomCategoryCache();
}

/** Tudo o que referencia categorias, lido direto do banco (sem cache), para contar e unificar. */
export async function loadCategoryData(): Promise<CategoryData> {
  invalidateFinanceCaches();
  const [expenses, fixedExpenses, fixedIncomes, variable, budgets] = await Promise.all([
    getExpenses(), getFixedExpenses(), getIncomes(), getVariableTransactions(), getBudgets(),
  ]);
  return { expenses, fixedExpenses, fixedIncomes, variable, budgets };
}

/** Edita uma categoria personalizada sem mexer na data de criação (ordem da lista). */
export async function updateCustomCategory(cat: CustomCategory): Promise<void> {
  const { id, label, icon, color, categoryType } = cat;
  await setDoc(userDoc('customCategories', id), { id, label, icon, color, categoryType }, { merge: true });
  clearCustomCategoryCache();
}

/** Aplica um plano de unificação. Devolve quantos lançamentos foram movidos. */
export async function applyMergePlan(plan: MergePlan): Promise<number> {
  const { targetId } = plan;

  // 0. destino personalizado passa a valer para gastos e ganhos (antes de receber os lançamentos)
  if (plan.widenTarget) {
    await setDoc(userDoc('customCategories', targetId), { categoryType: 'both' }, { merge: true });
  }

  // 1. lançamentos
  await inBatches(plan.updates, (batch, u) => {
    batch.update(userDoc(u.collection, u.id), { category: targetId });
  });

  // 2a. orçamentos (doc id = categoria)
  if (plan.budget) {
    const { amount, removeIds } = plan.budget;
    const batch = writeBatch(db);
    batch.set(userDoc('budgets', targetId), { category: targetId, amount });
    removeIds.forEach(id => batch.delete(userDoc('budgets', id)));
    await batch.commit();
  }

  // 2b. Classificador de gastos: transações importadas e correções (exemplos de treino)
  if (plan.mlRelabel) {
    const { from, to } = plan.mlRelabel;
    const [txs, examples] = await Promise.all([
      getDocs(query(userCol('mlTransactions'), where('category', 'in', from))),
      getDocs(query(userCol('mlExamples'), where('label', 'in', from))),
    ]);
    await inBatches(txs.docs, (batch, d) => batch.update(d.ref, { category: to }));
    await inBatches(examples.docs, (batch, d) => batch.update(d.ref, { label: to }));
  }

  // 3. por último, as categorias personalizadas que deixaram de existir
  await inBatches(plan.deleteCustomIds, (batch, id) => batch.delete(userDoc('customCategories', id)));

  invalidateFinanceCaches();
  return plan.updates.length;
}
