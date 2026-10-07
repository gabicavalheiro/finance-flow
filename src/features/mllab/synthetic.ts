// Dados sintéticos para a demonstração pública de ML (/ml-lab).
// Gerados no navegador com semente fixa: o mesmo ajuste sempre produz a mesma série,
// e como sabemos o "futuro" de verdade, dá para mostrar o modelo sendo avaliado de forma honesta.

export type ProfileId = 'estavel' | 'tendencia' | 'sazonal' | 'picos';

export interface Profile {
  id: ProfileId;
  label: string;
  description: string;
}

export const PROFILES: Profile[] = [
  { id: 'estavel', label: 'Estável', description: 'Gasto em torno de um valor fixo, com ruído.' },
  { id: 'tendencia', label: 'Tendência de alta', description: 'Gasto cresce ~2% ao mês.' },
  { id: 'sazonal', label: 'Sazonal', description: 'Ciclo anual com pico em dezembro.' },
  { id: 'picos', label: 'Com picos', description: 'Meses normais e picos ocasionais (viagem, conserto…).' },
];

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface GenerateOptions {
  profile: ProfileId;
  months: number;
  /** desvio relativo do ruído (0–0,5) */
  noise: number;
  seed: number;
  /** nível médio mensal em R$ */
  base?: number;
}

/** Série mensal de gasto discricionário (R$), sempre ≥ 0. */
export function generateSeries({ profile, months, noise, seed, base = 2000 }: GenerateOptions): number[] {
  const rand = mulberry32(seed);
  return Array.from({ length: months }, (_, t) => {
    let level = base;
    if (profile === 'tendencia') level = base * (1 + 0.02 * t);
    if (profile === 'sazonal') {
      const monthOfYear = t % 12; // série começa em janeiro
      level = base * (1 + 0.18 * Math.sin((2 * Math.PI * (monthOfYear - 2)) / 12) + (monthOfYear === 11 ? 0.35 : 0));
    }
    let value = level * (1 + noise * gaussian(rand));
    if (profile === 'picos' && rand() < 0.15) value += base * (0.8 + rand());
    return Math.max(0, Math.round(value));
  });
}
