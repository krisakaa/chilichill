import { adminClient, hasSupabaseEnv, requireAdmin } from '../../../../lib/server-data';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const { id } = await params;
  const input = await request.json();
  const supabase = adminClient();
  const patch: Record<string, unknown> = {};
  if (typeof input.author === 'string') patch.author = input.author;
  if (typeof input.body === 'string') patch.body = input.body;
  if (typeof input.cityTag === 'string') patch.city_tag = input.cityTag;
  if (typeof input.mood === 'string') patch.mood = input.mood;
  if (typeof input.rating === 'number') patch.rating = input.rating;
  if (input.status) patch.status = input.status;
  if (typeof input.official === 'boolean') patch.official = input.official;
  const { error } = await supabase.from('messages').update(patch).eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const { id } = await params;
  const supabase = adminClient();
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

