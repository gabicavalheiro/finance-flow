// src/lib/ml/store.ts — persistência do Classificador de gastos no Firestore
//
// users/{uid}/mlTransactions/{id}  → transações importadas do CSV
// users/{uid}/mlExamples/{id}      → correções do usuário (viram exemplos de treino)
//
// Sem índices compostos: lemos a coleção inteira e ordenamos no cliente.
import {
  collection, doc, getDocs, writeBatch, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './../firebase';
import type { ExpenseCategory } from '../types';
import { normalize } from './text';
import type { UserExample } from './model';

export interface MlTransaction {
  id: string;
  date: string;               // yyyy-mm-dd
  description: string;
  amount: number;             // positivo
  category: ExpenseCategory;
  confidence: number;         // 0..1 (1 quando manual)
  source: 'model' | 'user';   // 'user' = o usuário escolheu; o modelo não sobrescreve
  sentToApp?: boolean;        // já lançada nos gastos do app
}

const BATCH = 400;

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return user.uid;
}
const txCol = () => collection(db, 'users', uid(), 'mlTransactions');
const exCol = () => collection(db, 'users', uid(), 'mlExamples');

/** Chave de deduplicação: mesma data + descrição normalizada + valor. */
export const txKey = (t: { date: string; description: string; amount: number }) =>
  `${t.date}|${normalize(t.description)}|${t.amount.toFixed(2)}`;

export async function getMlTransactions(): Promise<MlTransaction[]> {
  const snap = await getDocs(txCol());
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MlTransaction, 'id'>) }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
}

/**
 * Grava transações novas. Lançamentos idênticos que já existem são ignorados, mas o
 * mesmo lançamento repetido N vezes no arquivo vale N vezes (ex.: duas corridas iguais).
 * Retorna quantas foram gravadas e quantas já existiam.
 */
export async function addMlTransactions(
  items: Omit<MlTransaction, 'id'>[],
  existing: MlTransaction[],
): Promise<{ added: MlTransaction[]; duplicates: number }> {
  const have = new Map<string, number>();
  for (const t of existing) have.set(txKey(t), (have.get(txKey(t)) ?? 0) + 1);

  const fresh: Omit<MlTransaction, 'id'>[] = [];
  let duplicates = 0;
  for (const t of items) {
    const k = txKey(t);
    const n = have.get(k) ?? 0;
    if (n > 0) { have.set(k, n - 1); duplicates++; } else fresh.push(t);
  }

  const col = txCol();
  const added: MlTransaction[] = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const t of fresh.slice(i, i + BATCH)) {
      const ref = doc(col);
      batch.set(ref, { ...t, createdAt: serverTimestamp() });
      added.push({ id: ref.id, ...t });
    }
    await batch.commit();
  }
  return { added, duplicates };
}

/** Atualiza vários campos de várias transações (usado em "Reprocessar"). */
export async function updateMlTransactions(
  changes: { id: string; patch: Partial<Pick<MlTransaction, 'category' | 'confidence' | 'source' | 'sentToApp'>> }[],
): Promise<void> {
  const col = txCol();
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const c of changes.slice(i, i + BATCH)) batch.update(doc(col, c.id), c.patch);
    await batch.commit();
  }
}

export async function deleteAllMlTransactions(): Promise<number> {
  const snap = await getDocs(txCol());
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH)) batch.delete(d.ref);
    await batch.commit();
  }
  return snap.size;
}

// ── correções do usuário = exemplos de treino ───────────────────────────────
const slug = (text: string) => normalize(text).replace(/ /g, '_').slice(0, 120) || 'vazio';

export async function getMlExamples(): Promise<UserExample[]> {
  const snap = await getDocs(exCol());
  return snap.docs.map((d) => {
    const x = d.data() as { text: string; label: ExpenseCategory };
    return { text: x.text, label: x.label };
  });
}

/** O id é a descrição normalizada: corrigir a mesma descrição de novo só troca a categoria. */
export async function saveMlExample(text: string, label: ExpenseCategory): Promise<void> {
  await setDoc(doc(exCol(), slug(text)), { text, label, updatedAt: serverTimestamp() });
}
