import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import ErrorBoundary from '@/components/ErrorBoundary';

describe('estados de tela', () => {
  it('loading anuncia ocupado e tem texto para leitor de tela', () => {
    render(<LoadingState label="Carregando faturas" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando faturas')).toBeInTheDocument();
  });

  it('vazio mostra título, descrição e ação', () => {
    render(<EmptyState title="Nada aqui" description="Cadastre algo" action={<button>Cadastrar</button>} />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeInTheDocument();
  });

  it('erro usa role=alert e chama onRetry', () => {
    const retry = vi.fn();
    render(<ErrorState message="Falhou" onRetry={retry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('ErrorBoundary', () => {
  const Boom = ({ explode }: { explode: boolean }) => {
    if (explode) throw new Error('quebrou');
    return <p>tudo certo</p>;
  };

  it('mostra tela de recuperação em vez de tela em branco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom explode /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/encontrou um erro/i)).toBeInTheDocument();
  });

  it('volta ao normal quando a rota (resetKey) muda', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Boom explode /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="/b"><Boom explode={false} /></ErrorBoundary>);
    expect(screen.getByText('tudo certo')).toBeInTheDocument();
  });
});
