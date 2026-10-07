// src/lib/classifier/examples.ts — correções do usuário viram exemplos de treino (Firestore)
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { TrainingExample } from './api';

function uid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Usuário não autenticado');
  return u.uid;
}
const col = () => collection(db, 'users', uid(), 'classifierExamples');

/** Normaliza só pra gerar um id estável: a mesma descrição corrigida duas vezes sobrescreve. */
function keyFor(description: string): string {
  const s = description.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `ex_${h.toString(36)}`;
}

export async function getUserExamples(): Promise<TrainingExample[]> {
  const snap = await getDocs(col());
  return snap.docs
    .map(d => d.data() as { description?: string; category?: string })
    .filter(d => d.description && d.category)
    .map(d => ({ description: d.description!, category: d.category!, source: 'user' as const }));
}

export async function saveUserExample(description: string, category: string): Promise<void> {
  await setDoc(doc(col(), keyFor(description)), {
    description: description.trim().slice(0, 300),
    category,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserExample(description: string): Promise<void> {
  await deleteDoc(doc(col(), keyFor(description)));
}
