import { adminClient, hasSupabaseEnv, isMissingReactionTable, mapMessage, nestMessages, summarizeReactions, type MessageReactionRow } from '../../lib/server-data';

const MAX_IMAGES = 6;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

function normalizeImages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, MAX_IMAGES);
}

function pageParams(url: URL) {
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const rawOffset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIMIT));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0);
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  return { limit, offset, order };
}

async function reactionSummaries(supabase: ReturnType<typeof adminClient>, messageIds: string[], visitorId: string | null) {
  type Summary = ReturnType<typeof summarizeReactions> extends Map<string, infer T> ? T : never;
  if (!messageIds.length) return new Map<string, Summary>();
  const { data: reactionRows, error: reactionError } = await supabase
    .from('message_reactions')
    .select('message_id, visitor_id, type')
    .in('message_id', messageIds);
  if (!reactionError) return summarizeReactions(reactionRows as MessageReactionRow[], visitorId);
  if (isMissingReactionTable(reactionError)) return new Map<string, Summary>();
  throw reactionError;
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const url = new URL(request.url);
  const stationIds = url.searchParams.get('stationIds')?.split(',').filter(Boolean) ?? [];
  const stationId = url.searchParams.get('stationId');
  const all = url.searchParams.get('all') === '1';
  const visitorId = url.searchParams.get('visitorId');
  const { limit, offset, order } = pageParams(url);
  const supabase = adminClient();

  let query = supabase
    .from('messages')
    .select('*, message_images(url, thumb_url, sort_order)', { count: 'exact' })
    .eq('status', 'published')
    .is('parent_id', null)
    .order('official', { ascending: false })
    .order('created_at', { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);
  if (!all && stationIds.length) query = query.in('station_id', stationIds);
  else if (!all && stationId) query = query.eq('station_id', stationId);

  const { data, error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const roots = data ?? [];
  const rootIds = roots.map((message) => message.id);
  let replies: typeof roots = [];
  if (rootIds.length) {
    const { data: replyRows, error: replyError } = await supabase
      .from('messages')
      .select('*, message_images(url, thumb_url, sort_order)')
      .eq('status', 'published')
      .in('parent_id', rootIds)
      .order('created_at', { ascending: true });
    if (replyError) return Response.json({ error: replyError.message }, { status: 500 });
    replies = replyRows ?? [];
  }

  const rows = [...roots, ...replies];
  let reactions: Awaited<ReturnType<typeof reactionSummaries>>;
  try {
    reactions = await reactionSummaries(supabase, rows.map((message) => message.id), visitorId);
  } catch (reactionError) {
    return Response.json({ error: reactionError instanceof Error ? reactionError.message : 'Failed to load reactions' }, { status: 500 });
  }

  const total = count ?? 0;
  const nextOffset = offset + roots.length < total ? offset + roots.length : null;
  return Response.json({
    items: nestMessages(rows.map((message) => mapMessage(message, reactions.get(message.id)))),
    nextOffset,
    hasMore: nextOffset !== null,
  });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const input = await request.json();
  const images = normalizeImages(input.images);
  const imageThumbs = normalizeImages(input.imageThumbs);
  const supabase = adminClient();
  let parentId: string | null = null;
  let stationId = input.stationId;
  if (typeof input.parentId === 'string' && input.parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('messages')
      .select('id, station_id, status, parent_id')
      .eq('id', input.parentId)
      .single();
    if (parentError || !parent || parent.status !== 'published' || parent.parent_id) {
      return Response.json({ error: 'Parent message is not available' }, { status: 400 });
    }
    parentId = parent.id;
    stationId = parent.station_id;
  }
  if (!stationId) return Response.json({ error: 'Station is required' }, { status: 400 });
  const { data, error } = await supabase.from('messages').insert({
    station_id: stationId,
    parent_id: parentId,
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
      thumb_url: imageThumbs[index] || null,
      sort_order: index,
    })));
    if (imageError) return Response.json({ error: imageError.message }, { status: 500 });
  }

  return Response.json(mapMessage({ ...data, message_images: images.map((url, index) => ({ url, thumb_url: imageThumbs[index] || null, sort_order: index })) }));
}
