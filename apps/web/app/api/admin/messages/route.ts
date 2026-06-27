import { adminClient, hasSupabaseEnv, mapMessage, requireAdmin } from '../../../lib/server-data';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const supabase = adminClient();
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(mapMessage));
}

