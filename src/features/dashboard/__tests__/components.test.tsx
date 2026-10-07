import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionRow } from '../components/TransactionRow';
import { CategoryBreakdown } from '../components/CategoryBreakdown';

describe('TransactionRow', () => {
  it('mostra título, subtítulo e valor; receita ganha sinal de +', () => {
    render(<TransactionRow icon={<span />} title="Salário extra" subtitle="Pix · 05/10" amount={250} tone="income" />);
    expect(screen.getByText('Salário extra')).toBeTruthy();
    expect(screen.getByText('Pix · 05/10')).toBeTruthy();
    expect(screen.getByText(/^\+/).textContent).toContain('250');
  });

  it('botões de ação têm rótulo acessível e disparam os callbacks', () => {
    const onEdit = vi.fn(); const onDelete = vi.fn();
    render(<TransactionRow icon={<span />} title="Mercado" subtitle="À vista" amount={80} tone="expense"
      onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mercado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Mercado' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('sem callbacks, não renderiza botões (ex.: gastos fixos)', () => {
    render(<TransactionRow icon={<span />} title="Aluguel" subtitle="Fixo mensal" amount={1000} tone="expense" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('CategoryBreakdown', () => {
  const data = [{ name: 'Casa', value: 750 }, { name: 'Lazer', value: 250 }];

  it('calcula a participação de cada categoria', () => {
    render(<CategoryBreakdown data={data} />);
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2 categorias');
  });

  it('oculta valores quando o modo privacidade está ativo', () => {
    render(<CategoryBreakdown data={data} hidden />);
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0);
    expect(screen.queryByText(/750/)).toBeNull();
  });
});
