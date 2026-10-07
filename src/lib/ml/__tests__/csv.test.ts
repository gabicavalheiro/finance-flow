import { describe, it, expect } from 'vitest';
import { parseCsv, detectColumns, buildTransactions, parseAmount, parseDate } from '../csv';

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 1234.56], ['-23,90', -23.9], ['(50,00)', -50], ['50,00-', -50],
    ['R$ 1.234,56', 1234.56], ['-R$ 10,00', -10], ['12.34', 12.34], ['1.234', 1234], ['89.90', 89.9],
  ])('%s', (raw, n) => expect(parseAmount(raw)).toBeCloseTo(n, 2));
  it('rejeita texto', () => expect(parseAmount('abc')).toBeNull());
});

describe('parseDate', () => {
  it.each([
    ['01/10/2026', '2026-10-01'], ['1/10/26', '2026-10-01'], ['2026-10-05', '2026-10-05'], ['05 out 2026', '2026-10-05'],
  ])('%s', (raw, iso) => expect(parseDate(raw)).toBe(iso));
  it('rejeita data impossível', () => expect(parseDate('40/13/2026')).toBeNull());
});

describe('extrato', () => {
  it('conta corrente: negativos são gastos, positivos são entradas ignoradas', () => {
    const csv = parseCsv('Extrato\n\nData;Histórico;Valor;Saldo\n01/10/2026;"UBER *TRIP";-23,90;1.000,00\n02/10/2026;PIX RECEBIDO;1.500,00;2.500,00\n');
    const map = detectColumns(csv)!;
    const r = buildTransactions(csv, map);
    expect(r.expenses).toEqual([{ date: '2026-10-01', description: 'UBER *TRIP', amount: 23.9 }]);
    expect(r.skippedIncome).toBe(1);
  });
  it('fatura de cartão: tudo positivo vira gasto', () => {
    const csv = parseCsv('date,title,amount\n2026-10-01,Ifood,"1.234,56"\n2026-10-02,Posto Shell,89.90\n');
    const r = buildTransactions(csv, detectColumns(csv)!);
    expect(r.expenses.map((t) => t.amount)).toEqual([1234.56, 89.9]);
  });
  it('conta linhas inválidas', () => {
    const csv = parseCsv('Data;Descrição;Valor\n01/10/2026;Padaria;-10,00\nsem data;Mercado;-5,00\n');
    expect(buildTransactions(csv, detectColumns(csv)!).skippedInvalid).toBe(1);
  });
});
