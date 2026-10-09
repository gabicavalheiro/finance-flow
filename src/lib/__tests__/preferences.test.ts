import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null }, db: {} }));

import {
  DEFAULT_PREFERENCES, HOME_SECTIONS, alertAllowed, moveSection, normalizePreferences, visibleSections,
} from '../preferences';

describe('preferences', () => {
  it('sem nada salvo usa o padrão', () => {
    const p = normalizePreferences(null);
    expect(p).toEqual(DEFAULT_PREFERENCES);
    expect(p.homeOrder).toHaveLength(HOME_SECTIONS.length);
  });

  it('remove seções desconhecidas/duplicadas e acrescenta as que faltam no fim', () => {
    const p = normalizePreferences({ homeOrder: ['transactions', 'xyz', 'transactions', 'summary'], homeHidden: ['goals', 'abc'] });
    expect(p.homeOrder.slice(0, 2)).toEqual(['transactions', 'summary']);
    expect(new Set(p.homeOrder).size).toBe(HOME_SECTIONS.length);
    expect(p.homeHidden).toEqual(['goals']);
  });

  it('move seções sem sair dos limites', () => {
    const o = DEFAULT_PREFERENCES.homeOrder;
    expect(moveSection(o, o[0], -1)).toBe(o);
    expect(moveSection(o, o[0], 1)[1]).toBe(o[0]);
    expect(moveSection(o, o[o.length - 1], 1)).toBe(o);
  });

  it('visibleSections respeita ordem e seções escondidas', () => {
    const p = normalizePreferences({ homeOrder: ['checklist', 'summary'], homeHidden: ['summary'] });
    const v = visibleSections(p);
    expect(v[0]).toBe('checklist');
    expect(v).not.toContain('summary');
  });

  it('alertAllowed: janela desligada bloqueia tudo; grupos desligados bloqueiam só o seu', () => {
    const off = { ...DEFAULT_PREFERENCES.alerts, daily: false };
    expect(alertAllowed('card-today-1', off)).toBe(false);
    const noDue = { ...DEFAULT_PREFERENCES.alerts, dueDates: false };
    expect(alertAllowed('card-warn-1', noDue)).toBe(false);
    expect(alertAllowed('cashflow-1', noDue)).toBe(true);
    expect(alertAllowed('balance-neg', { ...noDue, balance: false })).toBe(false);
    expect(alertAllowed('inc-soon-1', { ...noDue, incomes: false })).toBe(false);
    expect(alertAllowed('next-neg', { ...noDue, nextMonth: false })).toBe(false);
  });

  it('valores inválidos viram o padrão', () => {
    const p = normalizePreferences({ showSidebar: 'sim', hints: 3, alerts: { daily: 'x' } });
    expect(p.showSidebar).toBe(true);
    expect(p.hints).toBe(true);
    expect(p.alerts.daily).toBe(true);
  });
});
