import type { CsvMapping } from './types.js';

export function detectDelimiter(text: string): CsvMapping['delimiter'] {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts: Record<CsvMapping['delimiter'], number> = {
    ',': (sample.match(/,/g)  || []).length,
    ';': (sample.match(/;/g)  || []).length,
    '\t': (sample.match(/\t/g) || []).length,
    '|': (sample.match(/\|/g) || []).length
  };
  let best: CsvMapping['delimiter'] = ',';
  let bestCount = -1;
  for (const d of Object.keys(counts) as Array<CsvMapping['delimiter']>) {
    if (counts[d] > bestCount) { best = d; bestCount = counts[d]; }
  }
  return best;
}

export function parseCsv(text: string, delimiter: CsvMapping['delimiter']): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); field = '';
        if (row.some((f) => f.length > 0)) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseAmount(text: string): number {
  if (!text) return 0;
  let s = text.trim();
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[^\d.,\-]/g, '');
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) s = parts.join('.');
    else s = s.replace(/,/g, '');
  }
  const value = Number.parseFloat(s);
  if (Number.isNaN(value)) return 0;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

export function parseDate(text: string, format: CsvMapping['date_format']): string | null {
  if (!text) return null;
  const s = text.trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const slashMatch = s.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
  if (slashMatch) {
    const a = slashMatch[1], b = slashMatch[2], c = slashMatch[3];
    let y: string, m: string, d: string;
    const useFormat = format === 'AUTO' ? (a.length === 4 ? 'YMD' : 'MDY') : format;
    if (useFormat === 'YMD' || a.length === 4) { y = a; m = b; d = c; }
    else if (useFormat === 'DMY')              { d = a; m = b; y = c; }
    else                                       { m = a; d = b; y = c; }
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10);
  return null;
}

export interface ParsedTxn {
  date: string;
  amount_cents: number;
  description: string;
  raw_row: string;
  valid: boolean;
  error?: string;
}

export function applyMapping(rows: string[][], mapping: CsvMapping): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  for (let i = mapping.skip_rows; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const dateText = row[mapping.date_col] ?? '';
    const amountText = row[mapping.amount_col] ?? '';
    const description = (row[mapping.description_col] ?? '').trim();
    const date = parseDate(dateText, mapping.date_format);
    let amount = parseAmount(amountText);
    if (mapping.invert_sign) amount = -amount;

    const raw_row = row.join(String(mapping.delimiter));

    if (!date) {
      out.push({ date: '', amount_cents: 0, description, raw_row, valid: false, error: `Bad date "${dateText}"` });
    } else if (amount === 0 && amountText.trim() !== '0' && amountText.trim() !== '0.00' && amountText.trim() !== '') {
      out.push({ date, amount_cents: 0, description, raw_row, valid: false, error: `Bad amount "${amountText}"` });
    } else {
      out.push({ date, amount_cents: amount, description, raw_row, valid: true });
    }
  }
  return out;
}
