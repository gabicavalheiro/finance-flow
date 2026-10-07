import { describe, it, expect } from 'vitest';
import { TextClassifier } from '../classifier';
import { trainClassifier, classify } from '../model';
import { SEED_EXAMPLES } from '../seedData';
import { HOLDOUT } from './holdout';

const model = trainClassifier([]);

describe('classificador de gastos', () => {
  it('acerta o conjunto de avaliação (escrito pelo autor — limite otimista)', () => {
    const hits = HOLDOUT.filter((e) => classify(model, e.text).category === e.label).length;
    expect(hits / HOLDOUT.length).toBeGreaterThanOrEqual(0.9);
  });

  it('generaliza para marcas que não viu (validação cruzada por 5 dobras)', () => {
    const folds = 5;
    let hits = 0;
    for (let f = 0; f < folds; f++) {
      const train = SEED_EXAMPLES.filter((_, i) => i % folds !== f);
      const test = SEED_EXAMPLES.filter((_, i) => i % folds === f);
      const m = TextClassifier.fit(train, { C: 30, fallbackLabel: 'other' });
      hits += test.filter((e) => m.predict(e.text).label === e.label).length;
    }
    expect(hits / SEED_EXAMPLES.length).toBeGreaterThanOrEqual(0.4);
  }, 60_000);

  it('confiança maior quando acerta do que quando erra', () => {
    const ok: number[] = [], bad: number[] = [];
    for (const e of HOLDOUT) {
      const c = classify(model, e.text);
      (c.category === e.label ? ok : bad).push(c.confidence);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
    if (bad.length) expect(avg(ok)).toBeGreaterThan(avg(bad));
    expect(avg(ok)).toBeGreaterThan(0.5);
  });

  it('aprende com a correção do usuário', () => {
    const text = 'XPTO LANCHES 123';
    const before = classify(model, text);
    const target = before.category === 'health' ? 'education' : 'health';
    const learned = classify(trainClassifier([{ text, label: target }]), text);
    expect(learned.category).toBe(target);
  });

  it('texto sem nenhum atributo conhecido não inventa confiança', () => {
    const p = model.predict('zzzz qqqq');
    expect(p.known).toBe(false);
    expect(p.confidence).toBe(0);
  });

  it('é determinístico', () => {
    const a = trainClassifier([]).predict('UBER *TRIP');
    const b = trainClassifier([]).predict('UBER *TRIP');
    expect(a.label).toBe(b.label);
    expect(a.confidence).toBeCloseTo(b.confidence, 10);
  });
});
