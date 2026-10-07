// src/lib/ml/csv.ts — leitura de extratos em CSV (bancos e cartões brasileiros)
//
// Cobre: separador `;` `,` ou tab, campos entre aspas, BOM, arquivo em UTF-8 ou
// Windows-1252, valores "1.234,56" / "-1234.56" / "(50,00)", datas dd/mm/aaaa,
// dd/mm/aa, aaaa-mm-dd e "05 out 2026". Detecta as colunas pelo nome do cabeçalho
// e, se falhar, pelo conteúdo.

import { normalize } from './text';

export interface ParsedCsv { headers: string[]; rows: string[][]; delimiter: string }
export interface ColumnMap { date: number; description: number; amount: number }
export interface ParsedTransaction { date: string; description: string; amount: number }
export interface BuildResult {
  /** Gastos (valor sempre positivo). */
  expenses: ParsedTransaction[];
  /** Entradas (créditos) ignoradas — só ocorre quando o arquivo mistura sinais. */
  skippedIncome: number;
  /** Linhas sem data, descrição ou valor legíveis. */
  skippedInvalid: number;
}

// ── decodificação ───────────────────────────────────────────────────────────
export function decodeCsvBuffer(buf: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

// ── parser CSV ──────────────────────────────────────────────────────────────
function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let best = ',', bestScore = -1;
  for (const d of [';', ',', '\t']) {
    const counts = sample.map((line) => {
      let n = 0, inQ = false;
      for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === d && !inQ) n++; }
      return n;
    });
    const min = Math.min(...counts);
    const score = min > 0 && counts.every((c) => c === counts[0]) ? min + 1000 : min;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function splitRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function parseCsv(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text);
  let records = splitRecords(text, delimiter);
  if (records.length === 0) return { headers: [], rows: [], delimiter };

  // ignora linhas de introdução (menos colunas que o corpo da tabela)
  const freq = new Map<number, number>();
  records.forEach((r) => freq.set(r.length, (freq.get(r.length) ?? 0) + 1));
  const modal = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const firstFull = records.findIndex((r) => r.length === modal);
  records = records.slice(Math.max(0, firstFull)).filter((r) => r.length === modal);

  // a primeira linha é cabeçalho se nenhuma célula parece data ou número
  const first = records[0];
  const looksLikeData = first.some((c) => parseDate(c) !== null || parseAmount(c) !== null);
  if (looksLikeData) {
    return { headers: first.map((_, i) => `Coluna ${i + 1}`), rows: records, delimiter };
  }
  return { headers: first.map((h, i) => h || `Coluna ${i + 1}`), rows: records.slice(1), delimiter };
}

// ── valores e datas ─────────────────────────────────────────────────────────
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/-$/.test(s)) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/r\$|brl|usd|\$|\s/gi, '');
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // o último separador é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1) {
    // "1.234" (milhar) vs "12.34" (decimal)
    if (/\.\d{3}$/.test(s) && s.indexOf('.') === lastDot) s = s.replace('.', '');
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
const validYMD = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m && validYMD(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (validYMD(y, +m[2], +m[1])) return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  m = normalize(s).match(/^(\d{1,2}) (?:de )?([a-z]{3})[a-z]* (?:de )?(\d{4})/);
  if (m && MONTHS[m[2]] && validYMD(+m[3], MONTHS[m[2]], +m[1])) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(+m[1])}`;
  return null;
}

// ── colunas e transações ────────────────────────────────────────────────────
const sample = (rows: string[][], col: number, max = 200) =>
  rows.slice(0, max).map((r) => (r[col] ?? '').trim()).filter(Boolean);

const share = (cells: string[], ok: (c: string) => boolean) =>
  cells.length === 0 ? 0 : cells.filter(ok).length / cells.length;

/** Descobre as colunas de data, descrição e valor: primeiro pelo nome, depois pelo conteúdo. */
export function detectColumns(csv: ParsedCsv): ColumnMap | null {
  const heads = csv.headers.map((h) => normalize(h));
  const n = heads.length;
  const find = (re: RegExp, skip: number[] = []) =>
    heads.findIndex((h, i) => !skip.includes(i) && re.test(h));

  let date = find(/\b(data|date|dt)\b/);
  let amount = find(/\b(valor|amount|montante|quantia|value)\b/, date < 0 ? [] : [date]);
  if (amount >= 0 && /saldo|balance/.test(heads[amount])) amount = -1;
  let description = find(
    /(descri|historico|estabelecimento|detalhe|memo|titulo|title|nome|lancamento|beneficiario)/,
    [date, amount].filter((i) => i >= 0),
  );

  if (date < 0) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      const sh = share(sample(csv.rows, i), (c) => parseDate(c) !== null);
      if (sh > best && sh >= 0.6) { best = sh; date = i; }
    }
  }
  if (amount < 0) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (i === date || /saldo|balance/.test(heads[i])) continue;
      const cells = sample(csv.rows, i);
      const sh = share(cells, (c) => parseAmount(c) !== null && parseDate(c) === null);
      if (sh > best && sh >= 0.6) { best = sh; amount = i; }
    }
  }
  if (description < 0) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (i === date || i === amount) continue;
      const cells = sample(csv.rows, i);
      const text = cells.filter((c) => /[a-zA-Z]{3}/.test(c));
      if (!cells.length) continue;
      const score = (text.length / cells.length) * (text.reduce((a, c) => a + c.length, 0) / Math.max(1, text.length));
      if (score > best) { best = score; description = i; }
    }
  }
  if (date < 0 || amount < 0 || description < 0) return null;
  if (new Set([date, amount, description]).size < 3) return null;
  return { date, description, amount };
}

/**
 * Converte as linhas em gastos. Se o arquivo tiver valores negativos, os negativos são
 * os gastos e os positivos (créditos) são ignorados; se todos forem positivos (fatura de
 * cartão), todos são gastos.
 */
export function buildTransactions(csv: ParsedCsv, map: ColumnMap): BuildResult {
  const parsed: { date: string; description: string; amount: number }[] = [];
  let skippedInvalid = 0;
  for (const row of csv.rows) {
    const date = parseDate(row[map.date] ?? '');
    const amount = parseAmount(row[map.amount] ?? '');
    const description = (row[map.description] ?? '').replace(/\s+/g, ' ').trim();
    if (!date || amount === null || !description || amount === 0) { skippedInvalid++; continue; }
    parsed.push({ date, description, amount });
  }
  const hasNegative = parsed.some((t) => t.amount < 0);
  const expenses: ParsedTransaction[] = [];
  let skippedIncome = 0;
  for (const t of parsed) {
    if (hasNegative) {
      if (t.amount < 0) expenses.push({ ...t, amount: Math.abs(t.amount) });
      else skippedIncome++;
    } else {
      expenses.push(t);
    }
  }
  return { expenses, skippedIncome, skippedInvalid };
}
