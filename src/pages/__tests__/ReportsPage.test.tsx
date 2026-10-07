import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CreditCard, Expense, FixedExpense, FixedIncome } from '@/lib/types';

// Smoke test da página inteira: garante que a separação em abas/módulos continua ligada
// (as 4 abas renderizam e o popup de categoria abre) sem depender de Firebase.
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));
vi.mock('@/lib/store', async (orig) => ({
  ...(await orig<typeof import('@/lib/store')>()),
  getVariableForMonth: vi.fn().mockResolvedValue([]),
  getVariableTransactions: vi.fn().mockResolvedValue([]),
}));

// jsdom não tem layout: sem tamanho fixo o Recharts avisa "width(0) and height(0)" em todo gráfico.
vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>();
  const React = await import('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.createElement('div', { style: { width: 600, height: 300 } },
        React.cloneElement(children, { width: 600, height: 300 })),
  };
});

const finance = vi.fn();
vi.mock('@/contexts/FinanceDataContext', () => ({ useFinanceData: () => finance() }));

import ReportsPage from '../ReportsPage';

const card: CreditCard = {
  id: 'c1', name: 'Nubank', brand: 'mastercard', lastDigits: '1234', limit: 5000, closingDay: 10, dueDay: 17, active: true,
};
const expense: Expense = {
  id: 'e1', cardId: 'c1', name: 'Mercado', totalAmount: 600, category: 'food', date: '2026-01-05', installments: 24,
};
const fixed: FixedExpense = {
  id: 'f1', name: 'Aluguel', amount: 1000, category: 'home', paidMonths: [], paymentMethod: 'pix',
};
const income: FixedIncome = {
  id: 'i1', name: 'Salário', amount: 5000, category: 'salary', receiveDay: 5, receivedMonths: [],
};

const base = {
  cards: [card], expenses: [expense], fixedExpenses: [fixed], incomes: [income], subscriptions: [],
  loading: false, refresh: vi.fn().mockResolvedValue(undefined),
};

describe('ReportsPage', () => {
  beforeEach(() => finance.mockReturnValue(base));

  it('mostra só o indicador de carregamento enquanto os dados chegam', () => {
    finance.mockReturnValue({ ...base, loading: true });
    render(<ReportsPage />);
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
    expect(screen.queryByText(/mês mais leve/i)).not.toBeInTheDocument();
  });

  it('abre na aba Previsão com o painel de ML e os cartões de mês', async () => {
    render(<ReportsPage />);
    expect(await screen.findByText(/mês mais leve/i)).toBeInTheDocument();
    expect(await screen.findByText(/ainda não há histórico para prever/i)).toBeInTheDocument();
  });

  it('navega pelas abas Histórico, Fluxo e Categorias', async () => {
    render(<ReportsPage />);
    await screen.findByText(/mês mais leve/i);

    fireEvent.click(screen.getByRole('button', { name: /histórico/i }));
    expect(await screen.findByText(/últimos 6 meses/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /fluxo/i }));
    expect(await screen.findByText(/entradas vs saídas acumuladas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /categorias/i }));
    expect(await screen.findByText(/total gasto/i)).toBeInTheDocument();
  });

  it('clicar numa categoria abre o popup com os lançamentos dela', async () => {
    render(<ReportsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /categorias/i }));
    const row = await screen.findByRole('button', { name: /casa/i });
    fireEvent.click(row);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Casa');
    expect(dialog).toHaveTextContent('Aluguel');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });
});
