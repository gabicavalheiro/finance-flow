/**
 * importTransactions.ts
 *
 * Importação em massa de lançamentos via planilha (.xlsx/.csv).
 * - generateImportTemplate(): gera e baixa o modelo preenchível
 * - readSpreadsheetRows(): lê o arquivo enviado e devolve linhas cruas
 * - buildImportRows(): valida/mapeia cada linha para Expense ou VariableTransaction
 */

import * as XLSX from 'xlsx';
import {
  CreditCard, Expense, VariableTransaction,
  ExpenseCategory, IncomeCategory, PaymentMethod,
  CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, PAYMENT_METHOD_CONFIG,
} from './types';
import { CustomCategory } from './customCategories';
import { generateId } from './helpers';

// ─── Colunas do modelo ──────────────────────────────────────────────────────
export const TEMPLATE_HEADERS = [
  'tipo', 'movimento', 'data', 'nome', 'valor', 'categoria', 'forma_pagamento', 'cartao', 'parcelas',
] as const;

const TEMPLATE_EXAMPLE_ROWS = [
  ['variavel', 'despesa', '05/08/2026', 'Supermercado',      '250.90', 'Alimentação', 'PIX',    '',            ''],
  ['variavel', 'receita', '01/08/2026', 'Freelance design',  '600',    'Freelance',   'Transferência', '',      ''],
  ['cartao',   '',        '10/08/2026', 'Notebook novo',     '3600',   'Compras',     '',       'Nubank •1234', '6'],
];

function normalize(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

// \u2500\u2500\u2500 Cabe\u00e7alhos flex\u00edveis \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Aceita planilhas "reais" (extratos, controles pessoais) que n\u00e3o seguem
// exatamente os nomes do modelo \u2014 ex: "Descri\u00e7\u00e3o" em vez de "nome",
// "Valor (R$)" em vez de "valor".
const HEADER_ALIASES: Record<string, string> = {
  tipo: 'tipo', type: 'tipo',

  movimento: 'movimento', movimentacao: 'movimento', tipo_movimento: 'movimento',
  natureza: 'movimento',

  data: 'data', dia: 'data', date: 'data',

  nome: 'nome', descricao: 'nome', descricao_do_gasto: 'nome', historico: 'nome',
  lancamento: 'nome', item: 'nome', titulo: 'nome', name: 'nome', estabelecimento: 'nome',

  valor: 'valor', amount: 'valor', preco: 'valor', total: 'valor', valor_total: 'valor',

  categoria: 'categoria', category: 'categoria',

  forma_pagamento: 'forma_pagamento', pagamento: 'forma_pagamento', metodo: 'forma_pagamento',
  metodo_pagamento: 'forma_pagamento', forma: 'forma_pagamento',

  cartao: 'cartao', card: 'cartao',

  parcelas: 'parcelas', parcela: 'parcelas', installments: 'parcelas',

  observacao: 'observacao', obs: 'observacao', nota: 'observacao', notas: 'observacao',
  comentario: 'observacao', comentarios: 'observacao',
};

function normalizeHeaderKey(h: string): string {
  let s = String(h ?? '');
  s = s.replace(/\([^)]*\)/g, ''); // remove conte\u00fado entre par\u00eanteses, ex: "(R$)"
  s = normalize(s);
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s;
}

function resolveHeader(h: string): string {
  const key = normalizeHeaderKey(h);
  return HEADER_ALIASES[key] ?? key;
}

// ─── Geração do modelo ──────────────────────────────────────────────────────
export function generateImportTemplate(cards: CreditCard[]): void {
  const wb = XLSX.utils.book_new();

  const sheetData = [TEMPLATE_HEADERS as unknown as string[], ...TEMPLATE_EXAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 10 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 9 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');

  // Aba de referência: valores aceitos em cada coluna
  const expenseCats = Object.values(CATEGORY_CONFIG).map(c => c.label);
  const incomeCats  = Object.values(INCOME_CATEGORY_CONFIG).map(c => c.label);
  const methods     = Object.values(PAYMENT_METHOD_CONFIG).map(m => m.label);
  const cardNames    = cards.map(c => `${c.name} •${c.lastDigits}`);

  const refRows: (string | number)[][] = [
    ['Como preencher', ''],
    ['tipo', '"variavel" (gasto/receita solto) ou "cartao" (compra no cartão de crédito)'],
    ['movimento', 'apenas para tipo=variavel: "despesa" ou "receita"'],
    ['data', 'formato DD/MM/AAAA'],
    ['valor', 'número, use ponto ou vírgula para centavos (ex: 250.90)'],
    ['categoria', 'nome da categoria (veja lista abaixo) — se vazio, usa "Outros"'],
    ['forma_pagamento', 'apenas para tipo=variavel (veja lista abaixo) — se vazio, usa "Outro"'],
    ['cartao', 'apenas para tipo=cartao: nome do cartão cadastrado (ou parte do nome/últimos dígitos)'],
    ['parcelas', 'apenas para tipo=cartao: número de parcelas (padrão 1)'],
    ['', ''],
    ['Categorias de despesa', expenseCats.join(', ')],
    ['Categorias de receita', incomeCats.join(', ')],
    ['Formas de pagamento', methods.join(', ')],
    ['Seus cartões cadastrados', cardNames.length ? cardNames.join(', ') : '(nenhum cartão cadastrado ainda)'],
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!cols'] = [{ wch: 24 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Como preencher');

  XLSX.writeFile(wb, 'modelo-importacao-gastos.xlsx');
}

// ─── Leitura do arquivo ─────────────────────────────────────────────────────
export async function readSpreadsheetRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  return rows;
}

// ─── Parsing de valores ─────────────────────────────────────────────────────
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseValor(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    let s = v.trim();
    if (!s) return null;
    s = s.replace(/r\$/gi, '').replace(/\s/g, '');
    if (/,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  return null;
}

function parseData(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number' && isFinite(v)) {
    // Serial de data do Excel (fallback, caso cellDates não converta)
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    return null;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    return null;
  }
  return null;
}

// ─── Parcelas detectadas em extratos ───────────────────────────────────────
// Extratos de cartão costumam trazer cada parcela como uma linha separada,
// com o valor já sendo o da parcela (não o total da compra) e um texto tipo
// "Parcela 2/5" na observação (ou embutido no nome, ex: "Loja XParc02/05").
const OBS_PARC_RE  = /parcela\s*0*(\d+)\s*\/\s*0*(\d+)/i;
const NAME_PARC_RE = /\s*parc\.?\s*0*(\d+)\s*\/\s*0*(\d+)/i;

interface InstallmentInfo { current: number; total: number; matchedInName: boolean }

function parseInstallmentInfo(name: string, obs: string): InstallmentInfo | null {
  let m = OBS_PARC_RE.exec(obs);
  if (m) return { current: +m[1], total: +m[2], matchedInName: false };
  m = NAME_PARC_RE.exec(name);
  if (m) return { current: +m[1], total: +m[2], matchedInName: true };
  return null;
}

function stripInstallmentSuffix(name: string): string {
  return name.replace(NAME_PARC_RE, '').trim();
}

/**
 * Reconstrói a data de compra original a partir de uma ocorrência de parcela
 * (ex: "isso é a parcela 2 de 5, cobrada em junho/2026") usando o dia de
 * fechamento do cartão — mesma lógica usada no formulário manual de
 * "gasto no cartão" quando o usuário marca "qual parcela cai este mês".
 */
function computeCardPurchaseDate(occurrenceDate: string, currentInstallment: number): string {
  const [oy, om] = occurrenceDate.split('-').map(Number);
  const totalMonths = oy * 12 + (om - 1) - (currentInstallment - 1);
  const py = Math.floor(totalMonths / 12);
  const pm = totalMonths % 12 + 1;
  return `${py}-${pad(pm)}-01`;
}

// ─── Resolução de categoria / forma de pagamento / cartão ─────────────────
interface CategoryIndex {
  exact: Map<string, string>;       // label ou id normalizado -> id (match exato)
  fuzzy: { norm: string; id: string; label: string }[]; // apenas labels, p/ match parcial
}

function buildCategoryMaps(customCategories: CustomCategory[]): {
  expense: CategoryIndex; income: CategoryIndex;
} {
  const expense: CategoryIndex = { exact: new Map(), fuzzy: [] };
  const income:  CategoryIndex = { exact: new Map(), fuzzy: [] };

  (Object.entries(CATEGORY_CONFIG) as [ExpenseCategory, { label: string }][]).forEach(([id, cfg]) => {
    const n = normalize(cfg.label);
    expense.exact.set(n, id);
    expense.exact.set(normalize(id), id);
    if (n.length >= 4) expense.fuzzy.push({ norm: n, id, label: cfg.label });
  });
  (Object.entries(INCOME_CATEGORY_CONFIG) as [IncomeCategory, { label: string }][]).forEach(([id, cfg]) => {
    const n = normalize(cfg.label);
    income.exact.set(n, id);
    income.exact.set(normalize(id), id);
    if (n.length >= 4) income.fuzzy.push({ norm: n, id, label: cfg.label });
  });
  customCategories.forEach(c => {
    const n = normalize(c.label);
    if (c.categoryType === 'expense' || c.categoryType === 'both') {
      expense.exact.set(n, c.id);
      if (n.length >= 4) expense.fuzzy.push({ norm: n, id: c.id, label: c.label });
    }
    if (c.categoryType === 'income' || c.categoryType === 'both') {
      income.exact.set(n, c.id);
      if (n.length >= 4) income.fuzzy.push({ norm: n, id: c.id, label: c.label });
    }
  });
  return { expense, income };
}

/**
 * Resolve categoria por match exato e, se não encontrar, por substring
 * (ex: planilha tem "Lazer/Entretenimento" → bate com "Lazer";
 * "Financiamento/Empréstimo" → bate com "Empréstimo").
 */
function resolveCategoryMatch(input: string, index: CategoryIndex): string | undefined {
  const n = normalize(input);
  if (!n) return undefined;
  const exact = index.exact.get(n);
  if (exact) return exact;

  let best: { id: string; len: number } | undefined;
  for (const item of index.fuzzy) {
    if (n.includes(item.norm) || item.norm.includes(n)) {
      if (!best || item.norm.length > best.len) best = { id: item.id, len: item.norm.length };
    }
  }
  return best?.id;
}

function buildPaymentMap() {
  const map = new Map<string, PaymentMethod>();
  (Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, { label: string }][]).forEach(([id, cfg]) => {
    map.set(normalize(cfg.label), id);
    map.set(normalize(id), id);
  });
  // Aliases comuns
  map.set('dinheiro', 'cash');
  map.set('credito', 'other');
  map.set('crédito', 'other');
  return map;
}

function findCard(input: string, cards: CreditCard[]): CreditCard | undefined {
  const n = normalize(input);
  if (!n) return undefined;
  const digitsOnly = n.replace(/\D/g, '');
  return cards.find(c => {
    const cn = normalize(c.name);
    if (cn === n || n.includes(cn) || cn.includes(n)) return true;
    if (digitsOnly && c.lastDigits && digitsOnly.endsWith(c.lastDigits)) return true;
    return false;
  });
}

// ─── Tipo de resultado por linha ────────────────────────────────────────────
export interface ParsedImportRow {
  rowNumber: number;
  kind: 'variable' | 'card';
  name: string;
  amount: number | null;
  date: string | null;
  categoryLabel: string;
  errors: string[];
  warnings: string[];
  transaction?: VariableTransaction;
  expense?: Expense;
}

export function buildImportRows(
  rawRows: Record<string, unknown>[],
  cards: CreditCard[],
  customCategories: CustomCategory[],
): ParsedImportRow[] {
  const { expense: expenseIdx, income: incomeIdx } = buildCategoryMaps(customCategories);
  const paymentMap = buildPaymentMap();

  // Normaliza as chaves de cada linha — aceita variações de acento/maiúscula
  // e cabeçalhos "reais" (ex: "Descrição" → nome, "Valor (R$)" → valor).
  const norm = (row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = resolveHeader(k);
      if (out[key] === undefined || out[key] === '') out[key] = v;
    }
    return out;
  };

  return rawRows.map((rawOriginal, idx) => {
    const raw = norm(rawOriginal);
    const rowNumber = idx + 2; // +1 cabeçalho, +1 base 1
    const errors: string[] = [];
    const warnings: string[] = [];

    const obsInput = String(raw['observacao'] ?? '').trim();
    if (/n[aã]o\s*[eé]\s*gasto/i.test(obsInput)) {
      errors.push('Marcada como "não é gasto" na planilha — ignorada');
    }

    const cartaoInput = String(raw['cartao'] ?? '').trim();
    const matchedCard = cartaoInput ? findCard(cartaoInput, cards) : undefined;

    const amountRaw = parseValor(raw['valor']);
    if (amountRaw === null || amountRaw === 0) errors.push('Valor inválido');

    const tipoRaw = normalize(raw['tipo']);
    const kind: 'variable' | 'card' = tipoRaw === 'cartao' || tipoRaw === 'cartão' || tipoRaw === 'card'
      // Sem coluna "tipo": se o valor de "cartão" bate com um cartão já cadastrado, assume compra no
      // cartão — a menos que o valor seja negativo (estorno/reembolso não é uma "compra no cartão")
      || (!tipoRaw && !!matchedCard && (amountRaw === null || amountRaw >= 0))
      ? 'card' : 'variable';

    const nameRaw = String(raw['nome'] ?? '').trim();
    const installmentInfo = parseInstallmentInfo(nameRaw, obsInput);
    const name = installmentInfo?.matchedInName ? stripInstallmentSuffix(nameRaw) : nameRaw;
    if (!name) errors.push('Nome vazio');

    const date = parseData(raw['data']);
    if (!date) errors.push('Data inválida (use DD/MM/AAAA)');

    const movimentoRaw = normalize(raw['movimento']);
    let isIncome = kind === 'variable' && (movimentoRaw === 'receita' || movimentoRaw === 'entrada');

    // Valor negativo em extrato = estorno/reembolso → vira receita com valor positivo
    let amount = amountRaw;
    if (amount !== null && amount < 0) {
      amount = Math.abs(amount);
      if (kind === 'variable') {
        isIncome = true;
        warnings.push('Valor negativo — importado como receita (estorno/reembolso)');
      } else {
        warnings.push('Valor negativo — importado como valor positivo');
      }
    }

    // Categoria
    const catInput = String(raw['categoria'] ?? '').trim();
    const catIdx = isIncome ? incomeIdx : expenseIdx;
    let category: string = isIncome ? 'other_income' : 'other';
    let categoryLabel = isIncome ? 'Outros ganhos' : 'Outros';
    if (catInput) {
      const found = resolveCategoryMatch(catInput, catIdx);
      if (found) {
        category = found;
        categoryLabel = catInput;
      } else {
        warnings.push(`Categoria "${catInput}" não reconhecida — usando "${categoryLabel}"`);
      }
    }

    let transaction: VariableTransaction | undefined;
    let expense: Expense | undefined;

    if (kind === 'variable') {
      const methodInput = String(raw['forma_pagamento'] ?? '').trim();
      let paymentMethod: PaymentMethod = 'other';
      if (methodInput) {
        const found = paymentMap.get(normalize(methodInput));
        if (found) paymentMethod = found;
        else warnings.push(`Forma de pagamento "${methodInput}" não reconhecida — usando "Outro"`);
      }

      if (errors.length === 0) {
        transaction = {
          id: generateId(),
          name,
          amount: amount as number,
          type: isIncome ? 'income' : 'expense',
          paymentMethod,
          category: category as ExpenseCategory | IncomeCategory,
          date: date as string,
        };
      }
    } else {
      let card: CreditCard | undefined = matchedCard;
      if (!cards.length) {
        errors.push('Nenhum cartão cadastrado no app');
      } else if (cartaoInput) {
        if (!card) errors.push(`Cartão "${cartaoInput}" não encontrado`);
      } else if (cards.length === 1) {
        card = cards[0];
        warnings.push(`Cartão não informado — usando "${card.name}" (único cadastrado)`);
      } else {
        errors.push('Informe o cartão (mais de um cadastrado)');
      }

      let parcelas = parseInt(String(raw['parcelas'] ?? '1'), 10);
      if (!Number.isFinite(parcelas) || parcelas < 1) parcelas = 1;
      if (parcelas > 60) parcelas = 60;

      // Coluna "parcelas" não veio, mas detectamos "Parcela X/Y" na observação/nome
      // (comum em extratos, onde cada linha é uma parcela já lançada em um mês).
      // Reconstrói a compra original: valor total = valor da parcela × total de
      // parcelas, e data = mês da compra (calculado a partir do fechamento do
      // cartão), não o mês em que essa parcela específica apareceu no extrato.
      let expenseDate = date as string;
      let expenseAmount = amount as number;
      if (installmentInfo && (raw['parcelas'] === undefined || raw['parcelas'] === '')) {
        parcelas = installmentInfo.total;
        if (date) expenseDate = computeCardPurchaseDate(date, installmentInfo.current);
        if (amount !== null) expenseAmount = amount * installmentInfo.total;
        const [ey, em] = expenseDate.split('-');
        warnings.push(
          `Parcela ${installmentInfo.current}/${installmentInfo.total} detectada — `
          + `compra original estimada em ${em}/${ey}`,
        );
      }

      if (errors.length === 0 && card) {
        expense = {
          id: generateId(),
          cardId: card.id,
          name,
          totalAmount: expenseAmount,
          category: category as ExpenseCategory,
          date: expenseDate,
          installments: parcelas,
        };
      }
    }

    return {
      rowNumber, kind, name, amount, date, categoryLabel,
      errors, warnings, transaction, expense,
    };
  });
}
