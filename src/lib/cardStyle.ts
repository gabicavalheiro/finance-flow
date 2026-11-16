// Estilo único dos cartões de crédito (início, Cartões e Fatura).
// Vidro fosco, sem cor — só o ícone identifica o banco/bandeira (classe .card-glass
// em index.css). Os parâmetros de brand/customGradient não mudam mais a cor:
// ficam só pra não quebrar quem já chama esta função.

export function cardSurface(_brand?: string, _customGradient?: string): string {
  return 'transparent';
}

export const CARD_BORDER = '1px solid transparent';

export const CARD_GLASS_CLASS = 'card-glass';
