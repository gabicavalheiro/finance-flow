# 0004 — Regras financeiras em funções puras (fatura final x paga)

**Status:** Aceito

## Contexto
O valor de uma fatura aparecia em vários lugares (tela inicial, Faturas, categorias, orçamentos, vencimentos) e divergia quando o usuário informava o valor real. Além disso, "valor final" e "valor pago" eram a mesma coisa, o que impedia pagamento parcial.

## Decisão
- `CardInvoice.actualAmount` = **valor final** da fatura; `CardInvoice.paidAmount` = **quanto foi pago**.
- Faturas antigas (sem `paidAmount`) com `actualAmount > 0` contam como pagas por inteiro; `paidAmount = 0` é pendente.
- `lib/invoiceStatus.ts` decide o status (pendente, pago, parcial, pago a mais) e o quanto falta — sempre contra o valor final.
- `lib/invoiceAdjust.ts` redistribui as parcelas calculadas proporcionalmente ao valor final confirmado, para que categorias, orçamentos e vencimentos fechem com a fatura.
- Telas só consomem essas funções; não recalculam por conta própria.

## Consequências
- Uma única fonte de verdade, coberta por `invoiceStatus.test.ts` e `invoiceAdjust.test.ts`.
- Mudar a regra de fatura = mudar `lib/`, não as telas.
