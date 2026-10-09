// src/lib/firestorePaths.ts — ÚNICO lugar que monta caminhos do Firestore.
//
// Todo dado do usuário fica em users/{uid}/<coleção>/{id}, e o uid vem SEMPRE da sessão
// (auth.currentUser) — nunca de parâmetro de tela. Centralizar aqui evita que um módulo novo
// monte um caminho errado e garante que as firestore.rules (ADR 0003) sejam a única barreira
// a manter em sincronia.

import { collection, doc } from 'firebase/firestore';
import { auth, db } from './firebase';

/** uid do usuário logado; lança se não houver sessão. */
export function currentUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return user.uid;
}

/** Coleção do usuário logado: users/{uid}/{name}. */
export function userCol(name: string) {
  return collection(db, 'users', currentUid(), name);
}

/** Documento do usuário logado: users/{uid}/{name}/{id}. */
export function userDoc(name: string, id: string) {
  return doc(db, 'users', currentUid(), name, id);
}
