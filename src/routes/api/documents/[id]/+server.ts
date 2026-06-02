import { error } from '@sveltejs/kit';
import { deleteDocument, getDocument, readDocumentBytes } from '$lib/server/documents.js';

export async function GET({ params, url }: { params: { id: string }; url: URL }) {
  const doc = getDocument(Number(params.id));
  if (!doc) throw error(404, 'Not found');
  const bytes = readDocumentBytes(doc);
  if (!bytes) throw error(410, 'File missing on disk');
  const disposition = url.searchParams.get('download') ? 'attachment' : 'inline';
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': doc.mime_type,
      'content-disposition': `${disposition}; filename="${doc.filename.replace(/"/g, '')}"`,
      'cache-control': 'private, max-age=3600'
    }
  });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteDocument(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return new Response(null, { status: 204 });
}
