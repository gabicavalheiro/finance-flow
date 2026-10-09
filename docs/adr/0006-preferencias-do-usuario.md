# 0006 — Preferências: aparelho + Firestore

**Status:** Aceito

## Contexto
A tela de Configurações permite reorganizar a tela inicial, ocultar seções e silenciar avisos.

## Decisão
- `lib/preferences.ts` guarda no `localStorage` (aplica na hora) e sincroniza com `users/{uid}/settings/preferences` (vale em qualquer aparelho).
- Os dados lidos passam por `normalizePreferences`, que descarta valores inválidos e completa o que falta: nenhuma tela quebra com preferência corrompida.
- Só entram preferências de **interface**. Dados financeiros nunca vão para o `localStorage`.

## Consequências
- Nova seção da tela inicial = registrar em `HOME_SECTIONS` e em `Index.tsx`.
- Testes em `lib/__tests__/preferences.test.ts`.
