import { adminClient, hasSupabaseEnv, isMissingReactionTable, mapMessage, requireAdmin, summarizeReactions, type MessageReactionRow } from '../../../lib/server-data';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  if (!hasSupabaseEnv()) return Response.json({ fallback: true }, { status: 503 });
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*, message_images(url, sort_order)')
    .order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const messageIds = (data ?? []).map((message) => message.id);
  const reactions = new Map<string, ReturnType<typeof summarizeReactions> extends Map<string, infer T> ? T : never>();
  if (messageIds.length) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from('message_reactions')
      .select('message_id, visitor_id, type')
      .in('message_id', messageIds);
    if (!reactionError) {
      for (const [id, summary] of summarizeReactions(reactionRows as MessageReactionRow[])) reactions.set(id, summary);
    } else if (!isMissingReactionTable(reactionError)) return Response.json({ error: reactionError.message }, { status: 500 });
  }
  return Response.json((data ?? []).map((message) => mapMessage(message, reactions.get(message.id))));
}
