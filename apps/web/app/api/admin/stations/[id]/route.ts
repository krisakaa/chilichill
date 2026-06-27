import { adminClient, hasSupabaseEnv, mapStation, requireAdmin, stationToRow } from '../../../../lib/server-data';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const { id } = await params;
  const input = await request.json();
  const supabase = adminClient();
  const { data, error } = await supabase.from('stations').update(stationToRow(input)).eq('id', id).select('*').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(mapStation(data));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const { id } = await params;
  const supabase = adminClient();
  const orphan = await supabase.from('messages').update({ station_id: null }).eq('station_id', id);
  if (orphan.error) return Response.json({ error: orphan.error.message }, { status: 500 });
  const { error } = await supabase.from('stations').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

