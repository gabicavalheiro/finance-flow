/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Módulo de Metas ──────────────────────────────────────────────────────────
import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
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

// ─── Mappers ──────────────────────────────────────────────────────────────────
function dbToGoal(r: any): Goal {
  return {
    id:            r.id,
    name:          r.name,
    emoji:         r.emoji ?? '🎯',
    targetAmount:  r.target_amount,
    currentSaved:  r.current_saved ?? 0,
    monthsDeadline: r.months_deadline,
    startDate:     r.start_date,
    color:         r.color ?? '152 69% 45%',
    priority:      r.priority ?? 2,
    completedAt:   r.completed_at ?? undefined,
    createdAt:     r.created_at,
  };
}

function goalToDb(g: Goal, userId: string) {
  return {
    id:              g.id,
    user_id:         userId,
    name:            g.name,
    emoji:           g.emoji,
    target_amount:   g.targetAmount,
    current_saved:   g.currentSaved,
    months_deadline: g.monthsDeadline,
    start_date:      g.startDate,
    color:           g.color,
    priority:        g.priority,
    completed_at:    g.completedAt ?? null,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('priority')
    .order('created_at');
  if (error) { console.error('getGoals:', error); return []; }
  return (data ?? []).map(dbToGoal);
}

export async function addGoal(goal: Goal): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('goals').insert(goalToDb(goal, userId));
  if (error) throw error;
}

export async function updateGoal(goal: Goal): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('goals')
    .update(goalToDb(goal, userId))
    .eq('id', goal.id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

export async function updateGoalSaved(id: string, currentSaved: number): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ current_saved: currentSaved })
    .eq('id', id);
  if (error) throw error;
}
