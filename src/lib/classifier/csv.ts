// src/lib/classifier/csv.ts — leitor de extratos CSV de bancos/cartões brasileiros.
// Detecta separador (; , tab), encoding (UTF-8 ou Windows-1252), linha de cabeçalho,
// colunas de data/descrição/valor (ou débito/crédito) e números no formato BR (1.234,56).

export interface ParsedTx {
  id: string;
  date: string;          // YYYY-MM-DD ('' se não reconhecida)
  description: string;
  amount: number;        // sempre positivo = valor do gasto
}

export type SignMode = 'auto' | 'negative' | 'positive';

export interface ParseResult {
  transactions: ParsedTx[];
  skippedIncome: number;   // linhas descartadas por serem entradas/estornos
  skippedInvalid: number;  // linhas sem valor/descrição válidos
  signUsed: 'negative' | 'positive' | 'debit-column';
  columns: { date?: string; description: string; amount: string };
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const DATE_HEADERS   = ['data', 'date', 'data lancamento', 'data compra', 'data da compra', 'data movimentacao', 'dt'];
const DESC_HEADERS   = ['descricao', 'historico', 'lancamento', 'estabelecimento', 'description', 'title', 'titulo', 'detalhes', 'memo', 'nome', 'descricao da transacao'];
const AMOUNT_HEADERS = ['valor', 'amount', 'value', 'valor r', 'quantia', 'valor brl'];
const DEBIT_HEADERS  = ['debito', 'saida', 'saidas', 'valor debito'];

export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
  return text.replace(/^﻿/, '');
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10).join('\n');
  const counts = { ';': 0, ',': 0, '\t': 0 } as Record<string, number>;
  for (const d of Object.keys(counts)) counts[d] = (sample.match(new RegExp(d === '\t' ? '\\t' : `\\${d}`, 'g')) ?? []).length;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Divide uma linha respeitando aspas ("a;b" e "" escapado). */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === delim && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

export function parseAmount(v: string): number | null {
  let s = (v ?? '').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/-$/.test(s)) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/r\$/gi, '').replace(/\s/g, '');
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseDate(v: string): string {
  const s = (v ?? '').trim();
  const pad = (n: string | number) => String(n).padStart(2, '0');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) return `20${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}

function findCol(headers: string[], candidates: string[]): number {
  const h = headers.map(norm);
  for (const c of candidates) { const i = h.indexOf(c); if (i >= 0) return i; }
  for (const c of candidates) { const i = h.findIndex(x => x.startsWith(c + ' ') || x.includes(c)); if (i >= 0) return i; }
  return -1;
}

export function parseStatement(text: string, signMode: SignMode = 'auto'): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error('O arquivo está vazio ou tem só uma linha.');
  const delim = detectDelimiter(lines);
  const rows = lines.map(l => splitLine(l, delim));

  // Cabeçalho: primeira linha (entre as 20 primeiras) que tenha descrição e valor/débito
  let headerIdx = -1, descCol = -1, amountCol = -1, debitCol = -1, dateCol = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const d = findCol(rows[i], DESC_HEADERS);
    const a = findCol(rows[i], AMOUNT_HEADERS);
    const db = findCol(rows[i], DEBIT_HEADERS);
    if (d >= 0 && (a >= 0 || db >= 0)) {
      headerIdx = i; descCol = d; amountCol = a; debitCol = db; dateCol = findCol(rows[i], DATE_HEADERS);
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error('Não encontrei as colunas de descrição e valor. O cabeçalho precisa ter algo como "Descrição" e "Valor".');
  }

  const header = rows[headerIdx];
  const useDebit = amountCol < 0 && debitCol >= 0;
  const valueCol = useDebit ? debitCol : amountCol;

  type Raw = { date: string; description: string; value: number };
  const raws: Raw[] = [];
  let skippedInvalid = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const description = (r[descCol] ?? '').replace(/\s+/g, ' ').trim();
    const value = parseAmount(r[valueCol] ?? '');
    if (!description || value === null || value === 0) { skippedInvalid++; continue; }
    raws.push({ date: dateCol >= 0 ? parseDate(r[dateCol] ?? '') : '', description, value });
  }
  if (raws.length === 0) throw new Error('Nenhuma transação válida encontrada no arquivo.');

  let sign: 'negative' | 'positive';
  if (useDebit) sign = 'positive';
  else if (signMode === 'negative' || signMode === 'positive') sign = signMode;
  else {
    // Automático: o sinal mais frequente é o dos gastos (conta: mais débitos que créditos; cartão: mais compras que pagamentos)
    const neg = raws.filter(r => r.value < 0).length;
    sign = neg > raws.length - neg ? 'negative' : 'positive';
  }

  const expenses = raws.filter(r => (sign === 'negative' ? r.value < 0 : r.value > 0));
  const transactions: ParsedTx[] = expenses.map((r, i) => ({
    id: `tx-${i}`,
    date: r.date,
    description: r.description,
    amount: Math.abs(r.value),
  }));

  return {
    transactions,
    skippedIncome: raws.length - expenses.length,
    skippedInvalid,
    signUsed: useDebit ? 'debit-column' : sign,
    columns: { date: dateCol >= 0 ? header[dateCol] : undefined, description: header[descCol], amount: header[valueCol] },
  };
}
