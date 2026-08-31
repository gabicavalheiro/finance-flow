// ─── store_modules.ts — CRUD Firestore para Empréstimos e Investimentos ──────
// Segue exatamente o mesmo padrão de store.ts (users/{uid}/<coleção>/{id}).

import { collection, doc, getDocs, setDoc, deleteDoc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

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

// ═══════════════════════════════════════════════════════════════════════════════
// EMPRÉSTIMOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Loan {
  id: string;
  name: string;
  institution: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;    // % ao mês
  installments: number;
  paidInstallments: number;
  monthlyPayment: number;
  startDate: string;       // 'YYYY-MM-DD'
}

export async function getLoans(): Promise<Loan[]> {
  try {
    const snap = await getDocs(query(userCol('loans'), orderBy('createdAt')));
    return snap.docs.map(d => d.data() as Loan);
  } catch (err) {
    console.error('getLoans:', err);
    return [];
  }
}

export async function addLoan(loan: Loan): Promise<void> {
  await setDoc(userDoc('loans', loan.id), { ...loan, createdAt: serverTimestamp() });
}

export async function updateLoan(loan: Loan): Promise<void> {
  await setDoc(userDoc('loans', loan.id), loan, { merge: true });
}

export async function deleteLoan(id: string): Promise<void> {
  await deleteDoc(userDoc('loans', id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTIMENTOS
// ═══════════════════════════════════════════════════════════════════════════════

export type InvestmentType =
  | 'renda_fixa'
  | 'acoes'
  | 'fii'
  | 'crypto'
  | 'fundo'
  | 'outro';

export interface Investment {
  id: string;
  name: string;
  institution: string;
  type: InvestmentType;
  amountInvested: number;
  currentValue: number;
  startDate: string; // 'YYYY-MM-DD'
}

export async function getInvestments(): Promise<Investment[]> {
  try {
    const snap = await getDocs(query(userCol('investments'), orderBy('createdAt')));
    return snap.docs.map(d => d.data() as Investment);
  } catch (err) {
    console.error('getInvestments:', err);
    return [];
  }
}

export async function addInvestment(investment: Investment): Promise<void> {
  await setDoc(userDoc('investments', investment.id), { ...investment, createdAt: serverTimestamp() });
}

export async function updateInvestment(investment: Investment): Promise<void> {
  await setDoc(userDoc('investments', investment.id), investment, { merge: true });
}

export async function deleteInvestment(id: string): Promise<void> {
  await deleteDoc(userDoc('investments', id));
}
