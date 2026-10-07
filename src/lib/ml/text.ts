// src/lib/ml/text.ts — pré-processamento e extração de atributos (features)
// para descrições de transações bancárias ("UBER *TRIP HELP.UBER.COM", "IFD*PIZZARIA 123"...).

/** Palavras sem valor para classificar (ruído comum em extratos). */
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o', 'as', 'os',
  'ltda', 'me', 'epp', 'eireli', 'sa', 'com', 'br', 'www', 'http', 'https',
  'compra', 'compras', 'cartao', 'credito', 'debito', 'pagamento', 'pag', 'pgto',
  'parcela', 'parc', 'aprovada', 'visa', 'master', 'mastercard', 'elo',
]);

/** Números curtos que são parte do nome da marca (ex.: app "99"). */
const KEEP_NUMBERS = new Set(['99']);

/** minúsculas, sem acento, só [a-z0-9] separados por espaço. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) =>
      t.length > 1 &&
      !STOPWORDS.has(t) &&
      (!/^\d+$/.test(t) || KEEP_NUMBERS.has(t)),
    );
}

/**
 * Atributos de um texto, com contagem:
 *  - w:  palavras
 *  - b:  pares de palavras vizinhas
 *  - c:  trigramas a pentagramas de caracteres dentro de cada palavra
 *        (ajudam com nomes grudados e variações: "ifood" ~ "ifd*ifood", "mercadolivre")
 */
export function extractFeatures(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const feats = new Map<string, number>();
  const add = (k: string) => feats.set(k, (feats.get(k) ?? 0) + 1);

  tokens.forEach((t, i) => {
    add(`w:${t}`);
    if (i > 0) add(`b:${tokens[i - 1]}_${t}`);
    if (t.length >= 3) {
      const padded = ` ${t} `;
      for (let n = 3; n <= 5; n++) {
        for (let j = 0; j + n <= padded.length; j++) add(`c:${padded.slice(j, j + n)}`);
      }
    }
  });
  return feats;
}
