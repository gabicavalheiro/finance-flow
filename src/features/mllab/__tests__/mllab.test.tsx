import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('recharts', async (orig) => {
  const mod = await orig<typeof import('recharts')>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{(children as React.ReactElement)}</div>
    ),
  };
});

import { generateSeries } from '../synthetic';
import ForecastLab from '../ForecastLab';
import ClassifierLab from '../ClassifierLab';

describe('generateSeries', () => {
  const opts = { profile: 'sazonal' as const, months: 24, noise: 0.1, seed: 3 };

  it('é determinística para a mesma semente e muda com outra', () => {
    expect(generateSeries(opts)).toEqual(generateSeries(opts));
    expect(generateSeries({ ...opts, seed: 4 })).not.toEqual(generateSeries(opts));
  });

  it('nunca gera valores negativos e respeita o tamanho', () => {
    for (const profile of ['estavel', 'tendencia', 'sazonal', 'picos'] as const) {
      const s = generateSeries({ ...opts, profile, noise: 0.4 });
      expect(s).toHaveLength(24);
      expect(s.every((v) => v >= 0)).toBe(true);
    }
  });

  it('perfil de tendência cresce em média', () => {
    const s = generateSeries({ profile: 'tendencia', months: 24, noise: 0.02, seed: 1 });
    expect(s.slice(-6).reduce((a, b) => a + b) / 6).toBeGreaterThan(s.slice(0, 6).reduce((a, b) => a + b) / 6);
  });
});

describe('ForecastLab', () => {
  it('mostra a avaliação e a tabela de modelos candidatos', () => {
    render(<ForecastLab />);
    expect(screen.getByText('Previsão x realidade')).toBeTruthy();
    expect(screen.getByText(/Modelo escolhido/)).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(3);
  });

  it('com 3 meses de histórico avisa que não consegue se validar', () => {
    render(<ForecastLab />);
    fireEvent.change(screen.getByLabelText(/Meses de histórico/), { target: { value: '3' } });
    expect(screen.getByText(/não consegue se validar/)).toBeTruthy();
  });

  it('trocar o padrão de gasto atualiza o botão selecionado', () => {
    render(<ForecastLab />);
    const btn = screen.getByRole('button', { name: 'Com picos' });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('ClassifierLab', () => {
  it('classifica um exemplo e mostra a confiança', async () => {
    render(<ClassifierLab />);
    expect(await screen.findByText('Categoria prevista', {}, { timeout: 8000 })).toBeTruthy();
    // a categoria prevista aparece no título e na lista de probabilidades
    expect(screen.getAllByText('Transporte').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/confiante/)).toBeTruthy();
  }, 15000);

  it('texto desconhecido pede revisão ou avisa palpite sem base', async () => {
    render(<ClassifierLab />);
    const input = await screen.findByLabelText('Descrição do gasto', {}, { timeout: 8000 });
    fireEvent.change(input, { target: { value: 'zzqxv' } });
    expect((await screen.findAllByText(/palpite sem base|pedir revisão/)).length).toBeGreaterThan(0);
  }, 15000);
});
