import { error, json } from '@sveltejs/kit';
import { getDocument } from '$lib/server/documents.js';
import { scanDocument } from '$lib/server/ai.js';

export async function POST({ params }: { params: { id: string } }) {
  const doc = getDocument(Number(params.id));
  if (!doc) throw error(404, 'Document not found');
  try {
    const result = await scanDocument(doc);
    return json({ document_id: doc.id, activity_id: doc.activity_id, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw error(502, msg);
  }
}
