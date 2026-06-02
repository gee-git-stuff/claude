import { error, json } from '@sveltejs/kit';
import { listDocuments, saveDocument } from '$lib/server/documents.js';
import { getActivity } from '$lib/server/activities.js';

export async function GET({ params }: { params: { id: string } }) {
  const activityId = Number(params.id);
  if (!getActivity(activityId)) throw error(404, 'Activity not found');
  return json({ documents: listDocuments(activityId) });
}

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
  const activityId = Number(params.id);
  if (!getActivity(activityId)) throw error(404, 'Activity not found');

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw error(400, 'Missing file');

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const result = saveDocument(activityId, file.name, mime, buf);
  if (!result.ok) throw error(400, result.reason ?? 'Upload failed');
  return json({ document: result.document }, { status: 201 });
}
