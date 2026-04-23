/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── store_modules.ts — CRUD Supabase para Empréstimos e Investimentos ───────
// Segue exatamente o mesmo padrão de store.ts (uid, mappers, exports async).

import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
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

// ─── Mappers ──────────────────────────────────────────────────────────────────
function dbToLoan(r: any): Loan {
  return {
    id:               r.id,
    name:             r.name,
    institution:      r.institution ?? '',
    totalAmount:      r.total_amount,
    remainingAmount:  r.remaining_amount,
    interestRate:     r.interest_rate,
    installments:     r.installments,
    paidInstallments: r.paid_installments,
    monthlyPayment:   r.monthly_payment,
    startDate:        r.start_date,
  };
}

function loanToDb(l: Loan, userId: string) {
  return {
    id:                l.id,
    user_id:           userId,
    name:              l.name,
    institution:       l.institution || null,
    total_amount:      l.totalAmount,
    remaining_amount:  l.remainingAmount,
    interest_rate:     l.interestRate,
    installments:      l.installments,
    paid_installments: l.paidInstallments,
    monthly_payment:   l.monthlyPayment,
    start_date:        l.startDate,
  };
}

// ─── Funções CRUD ─────────────────────────────────────────────────────────────
export async function getLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToLoan);
}

export async function addLoan(loan: Loan): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('loans').insert(loanToDb(loan, userId));
  if (error) throw error;
}

export async function updateLoan(loan: Loan): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('loans')
    .update(loanToDb(loan, userId))
    .eq('id', loan.id);
  if (error) throw error;
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from('loans').delete().eq('id', id);
  if (error) throw error;
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

// ─── Mappers ──────────────────────────────────────────────────────────────────
function dbToInvestment(r: any): Investment {
  return {
    id:             r.id,
    name:           r.name,
    institution:    r.institution ?? '',
    type:           r.type as InvestmentType,
    amountInvested: r.amount_invested,
    currentValue:   r.current_value,
    startDate:      r.start_date,
  };
}

function investmentToDb(i: Investment, userId: string) {
  return {
    id:              i.id,
    user_id:         userId,
    name:            i.name,
    institution:     i.institution || null,
    type:            i.type,
    amount_invested: i.amountInvested,
    current_value:   i.currentValue,
    start_date:      i.startDate,
  };
}

// ─── Funções CRUD ─────────────────────────────────────────────────────────────
export async function getInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToInvestment);
}

export async function addInvestment(investment: Investment): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('investments')
    .insert(investmentToDb(investment, userId));
  if (error) throw error;
}

export async function updateInvestment(investment: Investment): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('investments')
    .update(investmentToDb(investment, userId))
    .eq('id', investment.id);
  if (error) throw error;
}

export async function deleteInvestment(id: string): Promise<void> {
  const { error } = await supabase.from('investments').delete().eq('id', id);
  if (error) throw error;
}
