import { adminClient, hasSupabaseEnv, isMissingReactionTable, mapMessage, summarizeReactions, type MessageReactionRow } from '../../lib/server-data';

const MAX_IMAGES = 6;

function normalizeImages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, MAX_IMAGES);
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const url = new URL(request.url);
  const stationIds = url.searchParams.get('stationIds')?.split(',').filter(Boolean) ?? [];
  const stationId = url.searchParams.get('stationId');
  const visitorId = url.searchParams.get('visitorId');
  const supabase = adminClient();
  let query = supabase
    .from('messages')
    .select('*, message_images(url, sort_order)')
    .eq('status', 'published')
    .order('official', { ascending: false })
    .order('created_at', { ascending: false });
  if (stationIds.length) query = query.in('station_id', stationIds);
  else if (stationId) query = query.eq('station_id', stationId);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const messageIds = (data ?? []).map((message) => message.id);
  let reactions = new Map<string, ReturnType<typeof summarizeReactions> extends Map<string, infer T> ? T : never>();
  if (messageIds.length) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from('message_reactions')
      .select('message_id, visitor_id, type')
      .in('message_id', messageIds);
    if (!reactionError) reactions = summarizeReactions(reactionRows as MessageReactionRow[], visitorId);
    else if (!isMissingReactionTable(reactionError)) return Response.json({ error: reactionError.message }, { status: 500 });
  }
  return Response.json((data ?? []).map((message) => mapMessage(message, reactions.get(message.id))));
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const input = await request.json();
  const images = normalizeImages(input.images);
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
    image: images[0] ?? input.image ?? '',
    status: 'published',
  }).select('*').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (images.length) {
    const { error: imageError } = await supabase.from('message_images').insert(images.map((url, index) => ({
      message_id: data.id,
      url,
      sort_order: index,
    })));
    if (imageError) return Response.json({ error: imageError.message }, { status: 500 });
  }

  return Response.json(mapMessage({ ...data, message_images: images.map((url, index) => ({ url, sort_order: index })) }));
}
