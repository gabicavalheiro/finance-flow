/**
 * queryCache.ts — Cache em memória com TTL para queries Supabase
 *
 * Uso:
 *   const data = await queryCache.get('cards', () => fetchCards(), 60_000);
 *   queryCache.invalidate('cards');     // invalida uma chave
 *   queryCache.invalidate('var:*');     // invalida por prefixo
 *   queryCache.invalidateAll();         // limpa tudo (logout)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class QueryCache {
  // Exposto como public para permitir leitura no getInvoicesForMonthRange
  public store = new Map<string, CacheEntry<unknown>>();

  /** Retorna valor em cache ou executa o fetcher e armazena o resultado. */
  async get<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30_000): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() < entry.expiresAt) {
      return entry.value;
    }
    const value = await fetcher();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  /** Define um valor diretamente no cache (sem chamar fetcher). */
  set<T>(key: string, value: T, ttlMs = 30_000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Invalida uma chave específica ou prefixo com wildcard `*`. */
  invalidate(keyOrPrefix: string): void {
    if (keyOrPrefix.endsWith('*')) {
      const prefix = keyOrPrefix.slice(0, -1);
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) this.store.delete(key);
      }
    } else {
      this.store.delete(keyOrPrefix);
    }
  }

  /** Invalida todas as entradas (usar no logout). */
  invalidateAll(): void {
    this.store.clear();
  }

  /** Verifica se existe valor válido em cache. */
  has(key: string): boolean {
    const entry = this.store.get(key);
    return !!entry && Date.now() < entry.expiresAt;
  }
}

export const queryCache = new QueryCache();
