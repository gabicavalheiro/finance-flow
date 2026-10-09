import { describe, it, expect } from 'vitest';
import { invoiceFinalAmount, invoicePaidAmount, invoicePaymentStatus } from '../invoiceStatus';

describe('invoiceStatus', () => {
  it('valor final usa o informado em Faturas, senão o calculado', () => {
    expect(invoiceFinalAmount({ actualAmount: 900 }, 800)).toBe(900);
    expect(invoiceFinalAmount({ actualAmount: 0 }, 800)).toBe(800);
    expect(invoiceFinalAmount(undefined, 800)).toBe(800);
  });

  it('valor pago: paidAmount explícito, legado = actualAmount, nada = 0', () => {
    expect(invoicePaidAmount({ actualAmount: 900, paidAmount: 300 })).toBe(300);
    expect(invoicePaidAmount({ actualAmount: 900, paidAmount: 0 })).toBe(0);
    expect(invoicePaidAmount({ actualAmount: 900, paidAmount: null })).toBe(900);
    expect(invoicePaidAmount({ actualAmount: 900 })).toBe(900);
    expect(invoicePaidAmount(undefined)).toBe(0);
  });

  it('"faltam" é medido contra o valor final da fatura', () => {
    const inv = { actualAmount: 900, paidAmount: 400 };
    const final = invoiceFinalAmount(inv, 800);
    expect(invoicePaymentStatus(invoicePaidAmount(inv), final)).toBe('partial');
    expect(final - invoicePaidAmount(inv)).toBe(500);
    // pago 850 seria "parcial" na fatura de 900, mas "a mais" contra o calculado 800
    expect(invoicePaymentStatus(850, 900)).toBe('partial');
    expect(invoicePaymentStatus(950, 900)).toBe('over');
    expect(invoicePaymentStatus(900, 900)).toBe('paid');
    expect(invoicePaymentStatus(0, 900)).toBe('pending');
  });
});
