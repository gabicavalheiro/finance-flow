# Registros de decisões de arquitetura (ADRs)

Cada ADR explica **uma** decisão: o contexto, o que foi escolhido, as alternativas e as consequências.
Formato curto, inspirado em Michael Nygard. Status possíveis: `Aceito`, `Substituído por NNNN`, `Descartado`.

| Nº | Decisão | Status |
|----|---------|--------|
| [0001](0001-stack-react-vite-firebase.md) | Stack: React + Vite + TypeScript + Firebase | Aceito |
| [0002](0002-organizacao-em-camadas.md) | Organização do código em camadas | Aceito |
| [0003](0003-isolamento-de-dados-firestore.md) | Isolamento de dados por usuário no Firestore | Aceito |
| [0004](0004-regras-financeiras-em-funcoes-puras.md) | Regras financeiras em funções puras (fatura final x paga) | Aceito |
| [0005](0005-previsao-local-first.md) | Previsão e classificação: modelo local primeiro, API opcional | Aceito |
| [0006](0006-preferencias-do-usuario.md) | Preferências: aparelho + Firestore | Aceito |
| [0007](0007-endurecimento-do-cliente.md) | Endurecimento do cliente (CSP, URLs, erros, senha, Android) | Aceito |

Para propor uma mudança: copie o último ADR, incremente o número e abra o PR junto com o código.
