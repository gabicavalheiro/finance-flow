// Hook da previsão de gastos: monta as séries, calcula o modelo local na hora e tenta
// "promover" o resultado para a API Python em segundo plano.

import { useEffect, useMemo, useState } from 'react';
import type { CreditCard, Expense, VariableTransaction } from '@/lib/types';
import { getVariableTransactions } from '@/lib/store';
import { forecastPortfolio, type PortfolioForecast } from '@/lib/ml/forecast';
import { buildDiscretionarySeries, type SpendingSeries } from '@/lib/ml/spendingSeries';
import { fetchForecastFromApi, isForecastApiConfigured } from '@/lib/ml/forecastApi';

export const FORECAST_HORIZON = 6;

export type ApiStatus = 'off' | 'loading' | 'ok' | 'failed';

export interface SpendingForecastState {
  status: 'loading' | 'ready' | 'error';
  history: SpendingSeries | null;
  forecast: PortfolioForecast | null;
  apiStatus: ApiStatus;
  reload: () => void;
}

export function useSpendingForecast(args: {
  expenses: Expense[]; cards: CreditCard[]; currentMonth: string;
}): SpendingForecastState {
  const { expenses, cards, currentMonth } = args;
  const [variable, setVariable] = useState<VariableTransaction[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);
  const [apiResult, setApiResult] = useState<{ key: string; data: PortfolioForecast } | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(isForecastApiConfigured() ? 'loading' : 'off');

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    getVariableTransactions()
      .then((v) => { if (alive) setVariable(v); })
      .catch((err) => { console.error('previsão: falha ao carregar transações', err); if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [tick]);

  const history = useMemo(
    () => (variable ? buildDiscretionarySeries({ expenses, cards, variable, currentMonth }) : null),
    [expenses, cards, variable, currentMonth],
  );

  const local = useMemo(() => {
    if (!history || !history.lastMonth) return null;
    return forecastPortfolio(history.byCategory, { lastMonth: history.lastMonth, horizon: FORECAST_HORIZON });
  }, [history]);

  // chave estável das séries: só refaz a chamada à API se os dados realmente mudaram
  const seriesKey = useMemo(
    () => (history?.lastMonth ? `${history.lastMonth}|${JSON.stringify(history.byCategory)}` : ''),
    [history],
  );

  useEffect(() => {
    if (!isForecastApiConfigured() || !history?.lastMonth || !seriesKey) return;
    if (apiResult?.key === seriesKey) return;
    const ctrl = new AbortController();
    setApiStatus('loading');
    fetchForecastFromApi(
      history.byCategory,
      { lastMonth: history.lastMonth, horizon: FORECAST_HORIZON },
      ctrl.signal,
    )
      .then((data) => { setApiResult({ key: seriesKey, data }); setApiStatus('ok'); })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.warn('previsão: API indisponível, mantendo modelo local —', err?.message ?? err);
        setApiStatus('failed');
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey]);

  const forecast = apiResult?.key === seriesKey ? apiResult.data : local;

  return {
    status: loadError ? 'error' : variable === null ? 'loading' : 'ready',
    history,
    forecast,
    apiStatus,
    reload: () => { setApiResult(null); setTick((t) => t + 1); },
  };
}
