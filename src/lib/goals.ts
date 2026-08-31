// ─── Módulo de Metas — migrado de Supabase/Postgres pra Firebase/Firestore ────
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
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

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Goal {
  id: string;
  name: string;
  emoji: string;           // ex: '🏠', '🚗', '✈️'
  targetAmount: number;    // valor total da meta
  currentSaved: number;    // quanto já foi guardado (atualização manual)
  monthsDeadline: number;  // em quantos meses quer atingir
  startDate: string;       // 'YYYY-MM-DD'
  color: string;           // ex: '152 69% 45%' (HSL sem hsl())
  priority: number;        // 1 = alta, 2 = média, 3 = baixa
  completedAt?: string;    // data de conclusão (se concluída)
  createdAt: string;
}

// ─── Cálculos derivados ───────────────────────────────────────────────────────
export interface GoalStats {
  remaining: number;            // targetAmount - currentSaved
  progressPct: number;          // 0–100
  monthlySavingsNeeded: number; // remaining / monthsDeadline
  monthsElapsed: number;        // meses desde startDate
  monthsLeft: number;           // monthsDeadline - monthsElapsed
  deadlineDate: string;         // data prevista de conclusão (YYYY-MM)
  isCompleted: boolean;
  isOverdue: boolean;           // passou do prazo sem concluir
  feasibility: 'ok' | 'tight' | 'hard'; // baseado no saldo mensal
}

export function computeGoalStats(goal: Goal, monthlyBalance: number): GoalStats {
  const remaining   = Math.max(0, goal.targetAmount - goal.currentSaved);
  const progressPct = goal.targetAmount > 0
    ? Math.min(100, (goal.currentSaved / goal.targetAmount) * 100)
    : 0;

  const start        = new Date(goal.startDate + 'T12:00:00');
  const now          = new Date();
  const monthsElapsed = Math.floor(
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  );
  const monthsLeft   = Math.max(0, goal.monthsDeadline - monthsElapsed);

  // Data prevista de conclusão
  const deadlineRaw  = new Date(start);
  deadlineRaw.setMonth(deadlineRaw.getMonth() + goal.monthsDeadline);
  const deadlineDate = `${deadlineRaw.getFullYear()}-${String(deadlineRaw.getMonth() + 1).padStart(2, '0')}`;

  const monthlySavingsNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;

  const isCompleted = remaining <= 0;
  const isOverdue   = !isCompleted && monthsLeft === 0;

  // Viabilidade: compara poupança necessária com saldo disponível
  let feasibility: GoalStats['feasibility'] = 'ok';
  if (monthlyBalance > 0) {
    const ratio = monthlySavingsNeeded / monthlyBalance;
    if (ratio > 0.9) feasibility = 'hard';
    else if (ratio > 0.6) feasibility = 'tight';
  } else {
    feasibility = remaining > 0 ? 'hard' : 'ok';
  }

  return {
    remaining, progressPct, monthlySavingsNeeded,
    monthsElapsed, monthsLeft, deadlineDate,
    isCompleted, isOverdue, feasibility,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  try {
    const snap = await getDocs(query(userCol('goals'), orderBy('priority'), orderBy('createdAt')));
    return snap.docs.map(d => d.data() as Goal);
  } catch (err) {
    console.error('getGoals:', err);
    return [];
  }
}

export async function addGoal(goal: Goal): Promise<void> {
  await setDoc(userDoc('goals', goal.id), { ...goal, createdAt: goal.createdAt || new Date().toISOString() });
}

export async function updateGoal(goal: Goal): Promise<void> {
  await setDoc(userDoc('goals', goal.id), goal, { merge: true });
}

export async function deleteGoal(id: string): Promise<void> {
  await deleteDoc(userDoc('goals', id));
}

export async function updateGoalSaved(id: string, currentSaved: number): Promise<void> {
  await updateDoc(userDoc('goals', id), { currentSaved });
}
