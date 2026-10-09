# 0001 — Stack: React + Vite + TypeScript + Firebase

**Status:** Aceito

## Contexto
App de finanças pessoais usado no navegador, instalável (PWA) e empacotável como app Android (Capacitor).
Equipe de uma pessoa: o custo de operar servidores precisa ser próximo de zero.

## Decisão
- **Front-end:** React 18, TypeScript, Vite, Tailwind e shadcn/ui (Radix), react-router, recharts, framer-motion.
- **Backend como serviço:** Firebase Auth (e-mail/senha) e Firestore. Não há servidor próprio para o CRUD.
- **ML opcional:** API FastAPI em `ml-api/` (ADR 0005).
- **Testes:** Vitest (unidade/componentes), Playwright (`e2e/`), pytest (`ml-api/tests`).

## Alternativas
- Supabase/Postgres (usado antes): migrado para o Firebase; as regras de segurança passaram de RLS para Security Rules (ADR 0003).
- Backend próprio: mais controle, mas exige operar, atualizar e proteger um servidor.

## Consequências
- Sem servidor para manter; a **segurança passa a depender das Security Rules** e da configuração do projeto Firebase.
- A chave `VITE_FIREBASE_API_KEY` é pública por desenho (identifica o projeto, não autoriza nada). Ela não é segredo.
- Dependência de um fornecedor (Firebase). Os acessos a dados ficam concentrados em `src/lib/` para facilitar uma troca.
