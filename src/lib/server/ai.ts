import { readFileSync } from 'node:fs';
import type { Document } from '../types.js';
import { getSetting } from './settings.js';

export interface ScanResult {
  vendor: string;
  date: string;
  total_cents: number;
  suggested_category: string;
  kind: 'EXPENSE' | 'INCOME';
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You extract structured data from receipts, invoices, and bills.
Return ONLY a single JSON object with these exact keys, no other text:
{
  "vendor":             "string  — the merchant or biller name",
  "date":               "YYYY-MM-DD  — transaction or invoice date",
  "total_cents":        "integer  — total amount in cents (e.g., $42.50 = 4250)",
  "suggested_category": "string  — e.g. Groceries, Utilities, Internet, Mortgage, Fuel, Dining, Insurance",
  "kind":               "EXPENSE  unless this is clearly a paycheck, refund, or money received, in which case INCOME",
  "notes":              "string  — short freeform description, e.g. line items summary",
  "confidence":         "high | medium | low"
}
If a field cannot be determined, use "" for strings or 0 for total_cents.`;

export async function scanDocument(doc: Document): Promise<ScanResult> {
  if (!doc.mime_type.startsWith('image/')) {
    throw new Error('Only image documents can be scanned. PDF rasterization is not yet supported.');
  }

  const url   = getSetting('ollama_url').replace(/\/$/, '');
  const model = getSetting('ollama_model');
  const bytes = readFileSync(doc.storage_path);
  const b64   = bytes.toString('base64');

  let res: Response;
  try {
    res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: SYSTEM_PROMPT,
        images: [b64],
        stream: false,
        format: 'json',
        options: { temperature: 0 }
      }),
      signal: AbortSignal.timeout(120_000)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot reach Ollama at ${url}. Is it running? (${msg})`);
  }

  if (!res.ok) {
    const text = await res.text();
    if (text.includes('not found') || res.status === 404) {
      throw new Error(`Model "${model}" not found. Run: ollama pull ${model}`);
    }
    throw new Error(`Ollama returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = await res.json() as { response?: string };
  if (!body.response) throw new Error('Ollama returned an empty response');

  let parsed: Partial<ScanResult>;
  try {
    parsed = JSON.parse(body.response);
  } catch {
    throw new Error(`Could not parse Ollama JSON: ${body.response.slice(0, 200)}`);
  }

  return {
    vendor:             String(parsed.vendor ?? '').slice(0, 200),
    date:               normalizeDate(String(parsed.date ?? '')),
    total_cents:        Math.max(0, Math.round(Number(parsed.total_cents ?? 0))),
    suggested_category: String(parsed.suggested_category ?? '').slice(0, 80),
    kind:               parsed.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
    notes:              String(parsed.notes ?? '').slice(0, 500),
    confidence:         parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium'
  };
}

function normalizeDate(s: string): string {
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdy) {
    let [, m, d, y] = mdy;
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export async function checkOllama(): Promise<{ ok: boolean; reason?: string; models?: string[] }> {
  const url = getSetting('ollama_url').replace(/\/$/, '');
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json() as { models?: Array<{ name: string }> };
    return { ok: true, models: (data.models ?? []).map((m) => m.name) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
