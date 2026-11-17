import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));
vi.mock('@/lib/store', async (orig) => ({
  ...(await orig<typeof import('@/lib/store')>()),
  getVariableTransactions: vi.fn().mockResolvedValue([]),
  getInvoicesForMonthRange: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/goals', async (orig) => ({
  ...(await orig<typeof import('@/lib/goals')>()),
  getGoals: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/budgets', () => ({ getBudgets: vi.fn().mockResolvedValue([]) }));
vi.mock('@/components/CategorySelect', () => ({ default: () => <div>categoria</div> }));
vi.mock('@/contexts/FinanceDataContext', () => ({
  useFinanceData: () => ({
    cards: [], expenses: [], subscriptions: [], loading: false,
    incomes: [{ id: 'i', name: 'Salário', amount: 5000, category: 'salary', receivedMonths: [] }],
    fixedExpenses: [{ id: 'f', name: 'Aluguel', amount: 3500, category: 'home', paidMonths: [], paymentMethod: 'pix' }],
  }),
}));

import PurchaseCheckPage from '../PurchaseCheckPage';

describe('PurchaseCheckPage', () => {
  it('responde com o veredito depois de perguntar', async () => {
    render(<MemoryRouter><PurchaseCheckPage /></MemoryRouter>);
    await screen.findByText('mesmo valor do Início');

    fireEvent.change(screen.getByLabelText('O que você quer comprar?'), { target: { value: 'Tênis' } });
    fireEvent.click(screen.getByRole('button', { name: /R\$\s?500/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Posso comprar?' }));

    await waitFor(() => expect(screen.getByText('Pode ir')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /R\$\s?3\.000/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Posso comprar?' }));
    await waitFor(() => expect(screen.getByText('Não recomendo agora')).toBeInTheDocument());
    expect(screen.getByText(/sem juros em 2x/)).toBeInTheDocument();
    // a conta do mês aparece linha a linha
    expect(screen.getByText('= Sobra sem a compra')).toBeInTheDocument();

    // Tornar uma meta: sobra 1.500 − reserva 500 = 1.000/mês → 3.000 em 3 meses
    fireEvent.click(screen.getByRole('button', { name: /Tornar uma meta/ }));
    expect(await screen.findByText('Seu plano')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 meses · sugerido/ })).toBeInTheDocument();
  });
});
