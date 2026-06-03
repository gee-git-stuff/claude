import { mkdirSync, unlinkSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { db } from './db.js';
import type { Document } from '../types.js';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? './data/uploads';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
]);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function listDocuments(activityId: number): Document[] {
  return db.prepare(`
    SELECT * FROM documents WHERE activity_id = ? ORDER BY uploaded_at DESC, id DESC
  `).all(activityId) as unknown as Document[];
}

export function getDocument(id: number): Document | undefined {
  return db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as unknown as Document | undefined;
}

export function readDocumentBytes(doc: Document): Buffer | null {
  if (!existsSync(doc.storage_path)) return null;
  return readFileSync(doc.storage_path);
}

interface SaveResult {
  ok: boolean;
  document?: Document;
  reason?: string;
}

export function saveDocument(activityId: number, filename: string, mimeType: string, bytes: Buffer): SaveResult {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, reason: `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit` };
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false, reason: `Unsupported file type: ${mimeType}` };
  }

  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'upload';
  const ext = extname(safeName) || guessExt(mimeType);
  const base = ext ? safeName.slice(0, safeName.length - ext.length) : safeName;
  const uuid = randomUUID();
  const dir = join(UPLOAD_ROOT, String(activityId));
  mkdirSync(dir, { recursive: true });
  const storage_path = join(dir, `${uuid}-${base}${ext}`);
  writeFileSync(storage_path, bytes);

  const r = db.prepare(`
    INSERT INTO documents (activity_id, filename, mime_type, size_bytes, storage_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(activityId, safeName, mimeType, bytes.byteLength, storage_path);

  const doc = getDocument(Number(r.lastInsertRowid))!;
  return { ok: true, document: doc };
}

export function deleteDocument(id: number): boolean {
  const doc = getDocument(id);
  if (!doc) return false;
  try {
    if (existsSync(doc.storage_path)) unlinkSync(doc.storage_path);
  } catch { /* file may already be gone */ }
  db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
  return true;
}

export function linkDocumentToEntry(docId: number, entryId: number | null): boolean {
  const r = db.prepare(`UPDATE documents SET entry_id = ? WHERE id = ?`).run(entryId, docId);
  return r.changes > 0;
}

function guessExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return '.jpg';
    case 'image/png':  return '.png';
    case 'image/gif':  return '.gif';
    case 'image/webp': return '.webp';
    case 'image/heic': return '.heic';
    case 'image/heif': return '.heif';
    case 'application/pdf': return '.pdf';
    case 'text/plain': return '.txt';
    case 'text/csv':   return '.csv';
    case 'text/markdown': return '.md';
    default: return '';
  }
}
