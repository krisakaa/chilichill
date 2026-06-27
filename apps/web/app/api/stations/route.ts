import { adminClient, hasSupabaseEnv, mapStation } from '../../lib/server-data';

export async function GET() {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const supabase = adminClient();
  const { data, error } = await supabase.from('stations').select('*').order('date', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(mapStation));
}

