import type { Message, Station, User, MessageStatus, ReactionType } from '@chili/shared';
import { SEED_STATIONS, SEED_MESSAGES, SEED_USERS } from './seed';

/**
 * 本地 mock 数据层（localStorage 持久化）。
 *
 * 接口刻意设计成与未来 Supabase 查询一致 —— 后续只需把每个方法体
 * 替换成 Supabase client 调用，调用方无需改动。
 *
 * 非 Web 环境（React Native）下 localStorage 退化为内存存储。
 */

type Reaction = { messageId: string; visitorId: string; type: ReactionType; createdAt: number };
type DB = { stations: Station[]; messages: Message[]; users: User[]; reactions: Reaction[] };
export type MessagePage = { items: Message[]; nextOffset: number | null; hasMore: boolean };
export type MessagePageOpts = { includeHidden?: boolean; visitorId?: string; limit?: number; offset?: number; order?: 'asc' | 'desc' };

const STORE_KEY = 'chilichill_diary_v1';

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

let mem: DB | null = null;

function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

function load(): DB {
  if (mem) return mem;
  if (hasLocalStorage()) {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try {
        mem = JSON.parse(raw) as DB;
        normalize(mem);
        return mem;
      } catch {
        /* fall through to seed */
      }
    }
  }
  mem = { stations: clone(SEED_STATIONS), messages: clone(SEED_MESSAGES), users: clone(SEED_USERS), reactions: [] };
  normalize(mem);
  persist();
  return mem;
}

function normalize(db: DB): void {
  db.reactions ??= [];
  const seedById = new Map(SEED_STATIONS.map((station) => [station.id, station]));
  for (const station of db.stations) {
    const seed = seedById.get(station.id);
    station.cityName ??= seed?.cityName ?? station.name;
    station.provinceName ??= seed?.provinceName ?? station.name;
    station.provinceAdcode ??= seed?.provinceAdcode;
  }
  for (const message of db.messages) {
    message.stationId ??= null;
    message.parentId ??= null;
    message.status ??= 'published';
    message.images ??= message.image ? [message.image] : [];
    message.imageThumbs ??= [];
    message.likesCount ??= 0;
    message.heartsCount ??= 0;
    message.viewerLiked ??= false;
    message.viewerHearted ??= false;
  }
}

function nestMessages(messages: Message[]): Message[] {
  const roots: Message[] = [];
  const byParent = new Map<string, Message[]>();
  for (const message of messages) {
    if (message.parentId) {
      const replies = byParent.get(message.parentId) ?? [];
      replies.push({ ...message, replies: [] });
      byParent.set(message.parentId, replies);
    } else {
      roots.push({ ...message, replies: [] });
    }
  }
  for (const root of roots) {
    root.replies = (byParent.get(root.id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
  }
  return roots;
}

function withReactionState(messages: Message[], visitorId?: string): Message[] {
  const db = load();
  return messages.map((message) => {
    const reactions = db.reactions.filter((reaction) => reaction.messageId === message.id);
    const likesCount = reactions.filter((reaction) => reaction.type === 'like').length;
    const heartsCount = reactions.filter((reaction) => reaction.type === 'heart').length;
    return {
      ...message,
      likesCount,
      heartsCount,
      viewerLiked: Boolean(visitorId && reactions.some((reaction) => reaction.visitorId === visitorId && reaction.type === 'like')),
      viewerHearted: Boolean(visitorId && reactions.some((reaction) => reaction.visitorId === visitorId && reaction.type === 'heart')),
    };
  });
}

function persist(): void {
  if (!mem) return;
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(mem));
    } catch {
      /* ignore quota */
    }
  }
}

function recount(db: DB): void {
  for (const s of db.stations) {
    s.count = db.messages.filter((m) => m.stationId === s.id && m.status === 'published').length;
  }
}

function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function pageMessages(messages: Message[], opts?: MessagePageOpts): MessagePage {
  const rawLimit = opts?.limit ?? 30;
  const rawOffset = opts?.offset ?? 0;
  const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 30));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0);
  const order = opts?.order === 'asc' ? 'asc' : 'desc';
  const roots = messages.filter((message) => !message.parentId);
  roots.sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || (order === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  const pageRoots = roots.slice(offset, offset + limit);
  const rootIds = new Set(pageRoots.map((message) => message.id));
  const replies = messages.filter((message) => message.parentId && rootIds.has(message.parentId));
  const items = nestMessages(withReactionState([...pageRoots, ...replies], opts?.visitorId));
  const nextOffset = offset + pageRoots.length < roots.length ? offset + pageRoots.length : null;
  return { items: clone(items), nextOffset, hasMore: nextOffset !== null };
}

/* ---------- 查询接口 ---------- */

export async function listStations(): Promise<Station[]> {
  const db = load();
  recount(db);
  return clone(db.stations);
}

export async function getStation(id: string): Promise<Station | null> {
  const db = load();
  return clone(db.stations.find((s) => s.id === id) ?? null);
}

export async function listMessages(stationId: string, opts?: MessagePageOpts): Promise<MessagePage> {
  const db = load();
  let msgs = db.messages.filter((m) => m.stationId === stationId);
  if (!opts?.includeHidden) msgs = msgs.filter((m) => m.status === 'published');
  // 官方置顶，再按时间倒序
  return pageMessages(msgs, opts);
}

export async function listMessagesForStations(stationIds: string[], opts?: MessagePageOpts): Promise<MessagePage> {
  const db = load();
  const ids = new Set(stationIds);
  let msgs = db.messages.filter((m) => m.stationId !== null && ids.has(m.stationId));
  if (!opts?.includeHidden) msgs = msgs.filter((m) => m.status === 'published');
  return pageMessages(msgs, opts);
}


export async function listAllPublicMessages(opts?: MessagePageOpts): Promise<MessagePage> {
  const db = load();
  const msgs = db.messages.filter((m) => m.status === 'published');
  return pageMessages(msgs, opts);
}
export async function listAllMessages(): Promise<Message[]> {
  const db = load();
  return clone(withReactionState([...db.messages].sort((a, b) => b.createdAt - a.createdAt)));
}

export async function listUsers(): Promise<User[]> {
  const db = load();
  return clone(db.users);
}

/* ---------- 写入接口 ---------- */

export async function createMessage(input: {
  stationId: string;
  parentId?: string | null;
  author: string;
  avatar: number;
  body: string;
  mood: string;
  rating: number;
  cityTag: string;
  image?: string;
  images?: string[];
  imageThumbs?: string[];
}): Promise<Message> {
  const db = load();
  let parentId: string | null = null;
  let stationId: string | null = input.stationId;
  if (input.parentId) {
    const parent = db.messages.find((message) => message.id === input.parentId && message.status === 'published' && !message.parentId);
    if (!parent) throw new Error('Parent message is not available');
    parentId = parent.id;
    stationId = parent.stationId;
  }
  const msg: Message = {
    id: uid('m'),
    stationId,
    parentId,
    author: input.author,
    avatar: input.avatar,
    official: false,
    body: input.body,
    mood: input.mood,
    rating: input.rating,
    cityTag: input.cityTag,
    image: input.images?.[0] ?? input.image ?? '',
    images: input.images ?? (input.image ? [input.image] : []),
    imageThumbs: input.imageThumbs ?? [],
    likesCount: 0,
    heartsCount: 0,
    viewerLiked: false,
    viewerHearted: false,
    status: 'published',
    createdAt: Date.now(),
  };
  db.messages.unshift(msg);
  persist();
  return clone(msg);
}

export async function toggleMessageReaction(messageId: string, type: ReactionType, visitorId: string): Promise<Pick<Message, 'likesCount' | 'heartsCount' | 'viewerLiked' | 'viewerHearted'>> {
  const db = load();
  const message = db.messages.find((item) => item.id === messageId && item.status === 'published');
  if (!message) throw new Error('Message is not available');
  const existing = db.reactions.findIndex((reaction) => reaction.messageId === messageId && reaction.visitorId === visitorId && reaction.type === type);
  if (existing >= 0) db.reactions.splice(existing, 1);
  else db.reactions.push({ messageId, visitorId, type, createdAt: Date.now() });
  persist();
  const [next] = withReactionState([message], visitorId);
  return {
    likesCount: next.likesCount,
    heartsCount: next.heartsCount,
    viewerLiked: next.viewerLiked,
    viewerHearted: next.viewerHearted,
  };
}

export async function upsertStation(input: Partial<Station> & { name: string }): Promise<Station> {
  const db = load();
  if (input.id) {
    const s = db.stations.find((x) => x.id === input.id);
    if (s) {
      Object.assign(s, input);
      persist();
      return clone(s);
    }
  }
  const station: Station = {
    id: uid('s'),
    code: input.code ?? input.name.slice(0, 2),
    name: input.name,
    cityName: input.cityName ?? input.name,
    provinceName: input.provinceName ?? input.name,
    provinceAdcode: input.provinceAdcode,
    venue: input.venue ?? '待定',
    date: input.date ?? '待定',
    x: input.x ?? 50,
    y: input.y ?? 50,
    status: input.status ?? 'upcoming',
    palette: input.palette ?? 'hot',
  };
  db.stations.push(station);
  persist();
  return clone(station);
}

export async function deleteStation(id: string): Promise<void> {
  const db = load();
  for (const message of db.messages) {
    if (message.stationId === id) message.stationId = null;
  }
  db.stations = db.stations.filter((s) => s.id !== id);
  persist();
}

export async function setMessageStatus(id: string, status: MessageStatus): Promise<void> {
  const db = load();
  const m = db.messages.find((x) => x.id === id);
  if (m) {
    m.status = status;
    persist();
  }
}

export async function setMessageOfficial(id: string, official: boolean): Promise<void> {
  const db = load();
  const m = db.messages.find((x) => x.id === id);
  if (m) {
    m.official = official;
    persist();
  }
}

export async function updateMessage(id: string, patch: Partial<Pick<Message, 'author' | 'body' | 'cityTag' | 'mood' | 'rating' | 'status' | 'official'>>): Promise<void> {
  const db = load();
  const m = db.messages.find((x) => x.id === id);
  if (!m) return;
  if (typeof patch.author === 'string') m.author = patch.author;
  if (typeof patch.body === 'string') m.body = patch.body;
  if (typeof patch.cityTag === 'string') m.cityTag = patch.cityTag;
  if (typeof patch.mood === 'string') m.mood = patch.mood;
  if (typeof patch.rating === 'number') m.rating = patch.rating;
  if (patch.status) m.status = patch.status;
  if (typeof patch.official === 'boolean') m.official = patch.official;
  persist();
}

export async function deleteMessage(id: string): Promise<void> {
  const db = load();
  const ids = new Set<string>([id]);
  for (const message of db.messages) {
    if (message.parentId === id) ids.add(message.id);
  }
  db.messages = db.messages.filter((m) => !ids.has(m.id));
  db.reactions = db.reactions.filter((reaction) => !ids.has(reaction.messageId));
  persist();
}

/** 重置为种子数据（开发/管理后台用） */
export async function resetData(): Promise<void> {
  mem = { stations: clone(SEED_STATIONS), messages: clone(SEED_MESSAGES), users: clone(SEED_USERS), reactions: [] };
  persist();
}
