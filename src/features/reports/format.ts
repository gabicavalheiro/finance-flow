// Formatação de meses (pt-BR) usada nas abas de Relatórios.

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function monthLabel(m: string, short = true) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('pt-BR', {
    month: short ? 'short' : 'long',
    year:  short ? undefined : 'numeric',
  });
}
export function monthLabelFull(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
