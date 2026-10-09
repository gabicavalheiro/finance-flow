// src/lib/safeUrl.ts — validação de URLs digitadas pelo usuário.
//
// Um href vindo do banco (ex.: link da assinatura) com esquema `javascript:` ou `data:` executa
// código ao ser clicado (XSS). Aqui só aceitamos http(s) — o resto é descartado.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Retorna a URL normalizada se for http(s) válida; caso contrário, `null`. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
