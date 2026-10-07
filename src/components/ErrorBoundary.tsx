// Captura erros de renderização de qualquer filho e mostra uma tela de recuperação
// em vez de deixar o app inteiro em branco (o clássico "blank screen" de erro de hook/rota).

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/states/StateViews';

interface Props {
  children: ReactNode;
  /** muda de valor => o boundary tenta de novo (ex.: pathname da rota) */
  resetKey?: string;
}
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-md mx-auto p-6 pt-16">
        <ErrorState
          title="Esta tela encontrou um erro"
          message="Seus dados estão salvos. Tente de novo; se o erro persistir, recarregue a página."
          onRetry={() => this.setState({ error: null })}
        />
      </div>
    );
  }
}
