import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Message, MessageStatus, Palette, ReactionType, Station, StationStatus } from '@chili/shared';

const ADMIN_COOKIE = 'chilichill_admin';

export type MessageImageInput = {
  url: string;
  sortOrder: number;
};

type StationRow = {
  id: string;
  code: string;
  name: string;
  city_name: string;
  province_name: string;
  province_adcode: number | null;
  venue: string;
  date: string;
  x: number;
  y: number;
  status: StationStatus;
  palette: Palette;
};

type MessageImageRow = {
  url: string;
  sort_order: number | null;
};

type MessageRow = {
  id: string;
  station_id: string | null;
  parent_id?: string | null;
  author: string;
  avatar: number;
  official: boolean;
  body: string;
  mood: string;
  rating: number;
  city_tag: string;
  image: string | null;
  status: MessageStatus;
  created_at: string;
  message_images?: MessageImageRow[] | null;
};

type ReactionSummary = {
  likesCount: number;
  heartsCount: number;
  viewerLiked: boolean;
  viewerHearted: boolean;
};

export type MessageReactionRow = {
  message_id: string;
  visitor_id: string;
  type: ReactionType;
};

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase server env');
  return createClient(url, key, { auth: { persistSession: false } });
}

export function mapStation(row: StationRow & { count?: number }): Station {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    cityName: row.city_name,
    provinceName: row.province_name,
    provinceAdcode: row.province_adcode ?? undefined,
    venue: row.venue,
    date: row.date,
    x: row.x,
    y: row.y,
    status: row.status,
    palette: row.palette,
    count: row.count,
  };
}

function imageUrls(row: MessageRow) {
  const next = (row.message_images ?? [])
    .filter((item) => item.url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => item.url);
  if (next.length) return next;
  return row.image ? [row.image] : [];
}

export function emptyReactionSummary(): ReactionSummary {
  return { likesCount: 0, heartsCount: 0, viewerLiked: false, viewerHearted: false };
}

export function summarizeReactions(rows: MessageReactionRow[] | null | undefined, visitorId?: string | null) {
  const result = new Map<string, ReactionSummary>();
  for (const row of rows ?? []) {
    const summary = result.get(row.message_id) ?? emptyReactionSummary();
    if (row.type === 'like') {
      summary.likesCount += 1;
      if (visitorId && row.visitor_id === visitorId) summary.viewerLiked = true;
    }
    if (row.type === 'heart') {
      summary.heartsCount += 1;
      if (visitorId && row.visitor_id === visitorId) summary.viewerHearted = true;
    }
    result.set(row.message_id, summary);
  }
  return result;
}

export function isMissingReactionTable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === '42P01' || Boolean(candidate.message?.includes('message_reactions'));
}

export function mapMessage(row: MessageRow, reactions?: Partial<ReactionSummary>): Message {
  const images = imageUrls(row);
  const summary = { ...emptyReactionSummary(), ...(reactions ?? {}) };
  return {
    id: row.id,
    stationId: row.station_id,
    parentId: row.parent_id ?? null,
    author: row.author,
    avatar: row.avatar,
    official: row.official,
    body: row.body,
    mood: row.mood,
    rating: row.rating,
    cityTag: row.city_tag,
    image: images[0] ?? '',
    images,
    likesCount: summary.likesCount,
    heartsCount: summary.heartsCount,
    viewerLiked: summary.viewerLiked,
    viewerHearted: summary.viewerHearted,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function nestMessages(messages: Message[]): Message[] {
  const byParent = new Map<string, Message[]>();
  const roots: Message[] = [];
  for (const message of messages) {
    const parentId = message.parentId ?? null;
    if (parentId) {
      const replies = byParent.get(parentId) ?? [];
      replies.push({ ...message, replies: [] });
      byParent.set(parentId, replies);
    } else {
      roots.push({ ...message, replies: [] });
    }
  }
  for (const root of roots) {
    root.replies = (byParent.get(root.id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
  }
  return roots;
}
export function stationToRow(input: Partial<Station> & { name: string }) {
  return {
    code: input.code ?? input.name.slice(0, 2),
    name: input.name,
    city_name: input.cityName ?? input.name,
    province_name: input.provinceName ?? input.name,
    province_adcode: input.provinceAdcode ?? null,
    venue: input.venue ?? '待定',
    date: input.date ?? '待定',
    x: input.x ?? 50,
    y: input.y ?? 50,
    status: input.status ?? 'upcoming',
    palette: input.palette ?? 'hot',
    updated_at: new Date().toISOString(),
  };
}

export function messageImageRows(messageId: string, images: string[]): MessageImageInput[] {
  return images.slice(0, 6).map((url, index) => ({
    url,
    sortOrder: index,
  }));
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === process.env.ADMIN_SESSION_SECRET;
}

export async function requireAdmin() {
  if (!(await isAdminSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function setAdminCookie() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('Missing ADMIN_SESSION_SECRET');
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
