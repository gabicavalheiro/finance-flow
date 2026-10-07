// Estilo único dos cartões de crédito (início, Cartões e Fatura).
// Superfície grafite; a cor do banco/bandeira aparece só como brilho no canto.

const SURFACE = 'linear-gradient(160deg, hsl(285 7% 15%) 0%, hsl(285 8% 9%) 100%)';

const BRAND_TINTS: Record<string, string> = {
  visa:       'hsl(210 85% 50% / 0.5)',
  mastercard: 'hsl(18 90% 52% / 0.45)',
  elo:        'hsl(42 90% 50% / 0.4)',
  amex:       'hsl(195 40% 55% / 0.4)',
  other:      'hsl(300 55% 60% / 0.45)',
};

/** Primeira cor do gradiente salvo do banco (ex.: "hsl(275 80% 45%)") com transparência. */
function tintFromGradient(gradient?: string): string | undefined {
  const m = gradient?.match(/hsl\(\s*([^)/]+?)\s*\)/);
  return m ? `hsl(${m[1]} / 0.55)` : undefined;
}

export function cardSurface(brand: string, customGradient?: string): string {
  const tint = tintFromGradient(customGradient) ?? BRAND_TINTS[brand] ?? BRAND_TINTS.other;
  return `radial-gradient(90% 130% at 100% 0%, ${tint} 0%, transparent 65%), ${SURFACE}`;
}

export const CARD_BORDER = '1px solid rgba(255,255,255,0.10)';
