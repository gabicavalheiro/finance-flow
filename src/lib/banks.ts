export interface BankInfo {
  name: string;
  color: string; // HSL
  gradient: string; // CSS gradient
  icon?: string;
}

export const BANK_CATALOG: BankInfo[] = [
  // Fintechs
  { name: 'Nubank', color: '275 80% 45%', gradient: 'linear-gradient(135deg, hsl(275 80% 45%), hsl(280 70% 35%))' },
  { name: 'Inter', color: '25 95% 50%', gradient: 'linear-gradient(135deg, hsl(25 95% 50%), hsl(15 90% 42%))' },
  { name: 'C6 Bank', color: '0 0% 12%', gradient: 'linear-gradient(135deg, hsl(0 0% 18%), hsl(0 0% 8%))' },
  { name: 'PicPay', color: '145 75% 40%', gradient: 'linear-gradient(135deg, hsl(145 75% 40%), hsl(155 70% 30%))' },
  { name: 'PagBank', color: '145 60% 42%', gradient: 'linear-gradient(135deg, hsl(85 55% 48%), hsl(145 60% 42%))' },
  { name: 'Neon', color: '195 85% 50%', gradient: 'linear-gradient(135deg, hsl(195 85% 50%), hsl(210 80% 42%))' },
  { name: 'Next', color: '145 70% 45%', gradient: 'linear-gradient(135deg, hsl(145 70% 45%), hsl(160 65% 35%))' },
  { name: 'Iti', color: '25 95% 55%', gradient: 'linear-gradient(135deg, hsl(25 95% 55%), hsl(15 85% 45%))' },
  { name: 'Will Bank', color: '55 90% 50%', gradient: 'linear-gradient(135deg, hsl(55 90% 50%), hsl(45 85% 40%))' },
  { name: 'Ame Digital', color: '340 80% 50%', gradient: 'linear-gradient(135deg, hsl(340 80% 50%), hsl(350 75% 40%))' },
  { name: 'Mercado Pago', color: '200 85% 48%', gradient: 'linear-gradient(135deg, hsl(200 85% 48%), hsl(210 80% 38%))' },
  { name: 'RecargaPay', color: '210 75% 50%', gradient: 'linear-gradient(135deg, hsl(210 75% 50%), hsl(220 70% 40%))' },
  { name: 'Digio', color: '215 80% 50%', gradient: 'linear-gradient(135deg, hsl(215 80% 50%), hsl(225 75% 40%))' },
  { name: 'Original', color: '145 60% 38%', gradient: 'linear-gradient(135deg, hsl(145 60% 38%), hsl(155 55% 28%))' },
  { name: 'Superdigital', color: '0 75% 50%', gradient: 'linear-gradient(135deg, hsl(0 75% 50%), hsl(10 70% 40%))' },

  // Bancos tradicionais
  { name: 'Itaú', color: '25 90% 50%', gradient: 'linear-gradient(135deg, hsl(25 90% 50%), hsl(210 70% 30%))' },
  { name: 'Bradesco', color: '0 75% 48%', gradient: 'linear-gradient(135deg, hsl(0 75% 48%), hsl(350 70% 38%))' },
  { name: 'Banco do Brasil', color: '55 85% 50%', gradient: 'linear-gradient(135deg, hsl(55 85% 50%), hsl(210 60% 40%))' },
  { name: 'Caixa', color: '210 75% 45%', gradient: 'linear-gradient(135deg, hsl(210 75% 45%), hsl(25 85% 50%))' },
  { name: 'Santander', color: '0 80% 45%', gradient: 'linear-gradient(135deg, hsl(0 80% 45%), hsl(350 75% 35%))' },
  { name: 'BTG Pactual', color: '210 25% 25%', gradient: 'linear-gradient(135deg, hsl(210 25% 30%), hsl(210 20% 18%))' },
  { name: 'Safra', color: '210 60% 35%', gradient: 'linear-gradient(135deg, hsl(210 60% 35%), hsl(220 55% 25%))' },
  { name: 'Sicredi', color: '120 55% 35%', gradient: 'linear-gradient(135deg, hsl(120 55% 35%), hsl(130 50% 25%))' },
  { name: 'Sicoob', color: '210 65% 40%', gradient: 'linear-gradient(135deg, hsl(210 65% 40%), hsl(145 55% 35%))' },
  { name: 'Banrisul', color: '210 70% 40%', gradient: 'linear-gradient(135deg, hsl(210 70% 40%), hsl(220 65% 30%))' },
  { name: 'Votorantim', color: '25 80% 45%', gradient: 'linear-gradient(135deg, hsl(25 80% 45%), hsl(210 50% 35%))' },

  // Cartões / Crédito
  { name: 'XP', color: '0 0% 15%', gradient: 'linear-gradient(135deg, hsl(0 0% 20%), hsl(0 0% 8%))' },
  { name: 'Rico', color: '25 90% 50%', gradient: 'linear-gradient(135deg, hsl(25 90% 50%), hsl(35 85% 40%))' },
  { name: 'Stone', color: '145 65% 40%', gradient: 'linear-gradient(135deg, hsl(145 65% 40%), hsl(155 60% 30%))' },
  { name: 'Credicard', color: '145 60% 42%', gradient: 'linear-gradient(135deg, hsl(145 60% 42%), hsl(155 55% 32%))' },
  { name: 'Pan', color: '210 70% 48%', gradient: 'linear-gradient(135deg, hsl(210 70% 48%), hsl(220 65% 38%))' },
  { name: 'BMG', color: '25 85% 50%', gradient: 'linear-gradient(135deg, hsl(25 85% 50%), hsl(15 80% 40%))' },
  { name: 'Daycoval', color: '210 55% 38%', gradient: 'linear-gradient(135deg, hsl(210 55% 38%), hsl(220 50% 28%))' },
  { name: 'Agibank', color: '275 65% 50%', gradient: 'linear-gradient(135deg, hsl(275 65% 50%), hsl(285 60% 40%))' },

  // Internacionais populares
  { name: 'Wise', color: '155 70% 42%', gradient: 'linear-gradient(135deg, hsl(155 70% 42%), hsl(165 65% 32%))' },
  { name: 'Revolut', color: '0 0% 12%', gradient: 'linear-gradient(135deg, hsl(240 5% 18%), hsl(0 0% 8%))' },
  { name: 'Nomad', color: '263 65% 50%', gradient: 'linear-gradient(135deg, hsl(263 65% 50%), hsl(273 60% 40%))' },
  { name: 'Avenue', color: '0 0% 10%', gradient: 'linear-gradient(135deg, hsl(0 0% 15%), hsl(0 0% 5%))' },
];

export function findBank(query: string): BankInfo | undefined {
  const q = query.toLowerCase().trim();
  return BANK_CATALOG.find(b => b.name.toLowerCase().includes(q));
}

export function searchBanks(query: string): BankInfo[] {
  if (!query.trim()) return BANK_CATALOG;
  const q = query.toLowerCase().trim();
  return BANK_CATALOG.filter(b => b.name.toLowerCase().includes(q));
}
