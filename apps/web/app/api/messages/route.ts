import { adminClient, hasSupabaseEnv, mapMessage } from '../../lib/server-data';

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const url = new URL(request.url);
  const stationIds = url.searchParams.get('stationIds')?.split(',').filter(Boolean) ?? [];
  const stationId = url.searchParams.get('stationId');
  const supabase = adminClient();
  let query = supabase
    .from('messages')
    .select('*')
    .eq('status', 'published')
    .order('official', { ascending: false })
    .order('created_at', { ascending: false });
  if (stationIds.length) query = query.in('station_id', stationIds);
  else if (stationId) query = query.eq('station_id', stationId);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(mapMessage));
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const input = await request.json();
  const supabase = adminClient();
  const { data, error } = await supabase.from('messages').insert({
    station_id: input.stationId,
    author: input.author,
    avatar: input.avatar,
    official: false,
    body: input.body,
    mood: input.mood,
    rating: input.rating,
    city_tag: input.cityTag,
    image: input.image ?? '',
    status: 'pending',
  }).select('*').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(mapMessage(data));
}

