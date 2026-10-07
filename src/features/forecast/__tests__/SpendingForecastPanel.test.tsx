import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { forecastPortfolio } from '@/lib/ml/forecast';

// O hook fala com Firebase/API; aqui o foco é o que o painel mostra em cada estado.
const hook = vi.fn();
vi.mock('../useSpendingForecast', () => ({ useSpendingForecast: (...a: unknown[]) => hook(...a) }));

import SpendingForecastPanel from '../SpendingForecastPanel';

const props = {
  expenses: [], cards: [], currentMonth: '2026-10',
  committedByMonth: { '2026-10': 1000 }, monthlyIncome: 5000,
};

function historyOf(values: number[]) {
  const months = values.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  return { months, byCategory: { food: values }, lastMonth: months[months.length - 1] };
}

function ready(values: number[], apiStatus = 'off') {
  const history = historyOf(values);
  const forecast = forecastPortfolio(history.byCategory, { lastMonth: history.lastMonth, horizon: 6 });
  return { status: 'ready', history, forecast, apiStatus, reload: vi.fn() };
}

describe('SpendingForecastPanel', () => {
  beforeEach(() => hook.mockReset());

  it('carregando: mostra skeleton acessível', () => {
    hook.mockReturnValue({ status: 'loading', history: null, forecast: null, apiStatus: 'off', reload: vi.fn() });
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('erro ao carregar: oferece tentar de novo', () => {
    hook.mockReturnValue({ status: 'error', history: null, forecast: null, apiStatus: 'off', reload: vi.fn() });
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });

  it('sem histórico: estado vazio explica o que fazer', () => {
    hook.mockReturnValue({
      status: 'ready', history: { months: [], byCategory: {}, lastMonth: null },
      forecast: null, apiStatus: 'off', reload: vi.fn(),
    });
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByText(/ainda não há histórico/i)).toBeInTheDocument();
  });

  it('poucos meses: avisa que a previsão não é confiável e não exibe métricas inventadas', () => {
    hook.mockReturnValue(ready([700, 900, 800]));
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByText(/3 meses completos/i)).toBeInTheDocument();
    expect(screen.getByText(/sem testes retroativos/i)).toBeInTheDocument();
  });

  it('histórico suficiente: mostra métricas de backtest e tabela de modelos', () => {
    hook.mockReturnValue(ready([900, 950, 880, 920, 910, 940, 900, 930, 925, 915]));
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByText(/quanto confiar/i)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /erro médio absoluto/i })).toBeInTheDocument();
    expect(screen.getAllByText(/testes retroativos/i).length).toBeGreaterThan(0);
  });

  it('diz que é modelo local ou API conforme a origem', () => {
    hook.mockReturnValue(ready([900, 950, 880, 920, 910, 940, 900, 930], 'failed'));
    render(<SpendingForecastPanel {...props} />);
    expect(screen.getByText(/API indisponível/i)).toBeInTheDocument();
  });
});
