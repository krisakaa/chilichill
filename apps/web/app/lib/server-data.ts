import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Message, MessageStatus, Palette, Station, StationStatus } from '@chili/shared';

const ADMIN_COOKIE = 'chilichill_admin';

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

type MessageRow = {
  id: string;
  station_id: string | null;
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

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    stationId: row.station_id,
    author: row.author,
    avatar: row.avatar,
    official: row.official,
    body: row.body,
    mood: row.mood,
    rating: row.rating,
    cityTag: row.city_tag,
    image: row.image ?? '',
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
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

