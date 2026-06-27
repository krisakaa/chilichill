import { adminClient, hasSupabaseEnv, mapStation, requireAdmin, stationToRow } from '../../../lib/server-data';

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const input = await request.json();
  const supabase = adminClient();
  const { data, error } = await supabase.from('stations').insert(stationToRow(input)).select('*').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(mapStation(data));
}

