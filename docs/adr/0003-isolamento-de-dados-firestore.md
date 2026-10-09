# 0003 — Isolamento de dados por usuário no Firestore

**Status:** Aceito

## Contexto
Os dados são sensíveis (renda, dívidas, cartões, investimentos). Como o app fala direto com o Firestore, **as regras são a única barreira** entre um usuário e os dados de outro.

## Decisão
- Todo dado vive em `users/{uid}/<coleção>/{id}`; o `uid` vem sempre de `auth.currentUser`, nunca de um parâmetro de tela, e todo caminho é montado em `src/lib/firestorePaths.ts` (único ponto).
- `firestore.rules`:
  - nega tudo por padrão;
  - libera leitura/escrita só ao dono (`request.auth.uid == userId`);
  - só nas coleções conhecidas (lista explícita), então um cliente adulterado não cria coleções novas;
  - limita o número de campos (60) e o tamanho do id (200) para conter abuso.
- O cache em memória (`queryCache`) é limpo no logout (`auth.onAuthStateChanged`).

## Alternativas
- Validar cada campo nas regras: mais seguro, mas frágil sem testes de regras (emulador). Ver "Próximos passos" em `SECURITY.md`.
- Backend intermediário validando tudo: descartado por custo operacional (ADR 0001).

## Consequências
- Nova coleção exige **atualizar a lista em `firestore.rules`** e publicar (`firebase deploy --only firestore:rules`); sem isso o app recebe `permission-denied`.
- Não há campo `user_id` nos documentos: o caminho é a fonte da verdade.
