import type { ReactionType } from '@chili/shared';
import { adminClient, hasSupabaseEnv, summarizeReactions, type MessageReactionRow } from '../../../../lib/server-data';

const REACTION_TYPES = new Set<ReactionType>(['like', 'heart']);
const VISITOR_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });

  let input: { type?: ReactionType; visitorId?: string };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = await params;
  const type = input.type;
  const visitorId = input.visitorId?.trim() ?? '';
  if (!type || !REACTION_TYPES.has(type)) return Response.json({ error: 'Invalid reaction type' }, { status: 400 });
  if (!VISITOR_ID_PATTERN.test(visitorId)) return Response.json({ error: 'Invalid visitor id' }, { status: 400 });

  const supabase = adminClient();
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('id, status')
    .eq('id', id)
    .single();
  if (messageError || !message || message.status !== 'published') {
    return Response.json({ error: 'Message is not available' }, { status: 404 });
  }

  const existing = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', id)
    .eq('visitor_id', visitorId)
    .eq('type', type)
    .maybeSingle();
  if (existing.error) return Response.json({ error: existing.error.message }, { status: 500 });

  if (existing.data?.id) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.data.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('message_reactions').insert({
      message_id: id,
      visitor_id: visitorId,
      type,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: reactionRows, error: reactionError } = await supabase
    .from('message_reactions')
    .select('message_id, visitor_id, type')
    .eq('message_id', id);
  if (reactionError) return Response.json({ error: reactionError.message }, { status: 500 });

  return Response.json(summarizeReactions(reactionRows as MessageReactionRow[], visitorId).get(id) ?? {
    likesCount: 0,
    heartsCount: 0,
    viewerLiked: false,
    viewerHearted: false,
  });
}
