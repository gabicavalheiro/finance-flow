// src/lib/budgets.ts — migrado de Supabase/Postgres pra Firebase/Firestore
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface Budget {
  category: string;
  amount: number;
}

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return user.uid;
}
function userCol(name: string) {
  return collection(db, 'users', uid(), name);
}
function userDoc(name: string, id: string) {
  return doc(db, 'users', uid(), name, id);
}

/** Busca todos os orçamentos do usuário */
export async function getBudgets(): Promise<Budget[]> {
  try {
    const snap = await getDocs(userCol('budgets'));
    return snap.docs
      .map(d => d.data() as Budget)
      .sort((a, b) => a.category.localeCompare(b.category));
  } catch (err) {
    console.error('getBudgets:', err);
    return [];
  }
}

/** Salva (upsert) um orçamento por categoria — doc id = a própria categoria */
export async function upsertBudget(category: string, amount: number): Promise<void> {
  await setDoc(userDoc('budgets', category), { category, amount });
}

/** Remove um orçamento de uma categoria */
export async function deleteBudget(category: string): Promise<void> {
  await deleteDoc(userDoc('budgets', category));
}
