'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Message, ReactionType, Station, User } from '@chili/shared';
import { listStations, listMessages, listMessagesForStations, listAllPublicMessages, createMessage, listAllMessages, listUsers, toggleMessageReaction } from '@chili/db';

export type Screen = 'map' | 'wall' | 'admin';
export type WallMode = 'city' | 'all';

export interface SubmitMessageInput {
  body: string;
  mood: string;
  rating: number;
  cityTag: string;
  image?: string;
  images?: string[];
  imageThumbs?: string[];
  parentId?: string | null;
}

interface AppContextValue {
  booted: boolean;
  screen: Screen;
  setScreen: (s: Screen) => void;

  stations: Station[];
  refreshStations: () => Promise<void>;

  curStation: Station | null;
  curCityStations: Station[];
  curSwitchStations: Station[];
  openWall: (s: Station) => void;
  openCityWall: (s: Station, cityStations: Station[], switchStations?: Station[]) => void;
  backToMap: () => void;
  wallMode: WallMode;
  openAllWall: () => Promise<void>;
  clearReplyTarget: () => void;

  messages: Message[];
  refreshMessages: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  messagesHasMore: boolean;
  messagesLoading: boolean;
  messagesLoadingMore: boolean;
  toggleReaction: (messageId: string, type: ReactionType) => Promise<void>;
  sortNew: boolean;
  toggleSort: () => void;

  user: User | null;
  login: (name: string, password?: string) => Promise<void>;
  logout: () => void;

  toast: string;
  showToast: (t: string) => void;
  submitMessage: (input: SubmitMessageInput) => Promise<void>;
  replyTarget: Message | null;
  openReplyComposer: (message: Message) => void;
  openAdmin: () => Promise<void>;
  footprintStationIds: string[];

  // modals
  loginOpen: boolean;
  setLoginOpen: (b: boolean) => void;
  composerOpen: boolean;
  setComposerOpen: (b: boolean) => void;
  lightbox: string | null;
  setLightbox: (s: string | null) => void;
  shareOpen: boolean;
  setShareOpen: (b: boolean) => void;
  shareMode: 'page' | 'footprint' | 'message';
  shareTargetMessage: Message | null;
  openShareCard: (mode: 'page' | 'footprint' | 'message', message?: Message | null) => void;
  closeShareCard: () => void;

  // admin data
  allMsgs: Message[];
  users: User[];
  refreshAdmin: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const VISITOR_KEY = 'chilichill_visitor_id';
const FOOTPRINT_KEY = 'chilichill_footprint_station_ids';
const MESSAGE_PAGE_SIZE = 30;

function getVisitorId() {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(VISITOR_KEY, next);
  return next;
}

function getFootprintStationIds() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FOOTPRINT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function saveFootprintStationIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FOOTPRINT_KEY, JSON.stringify([...new Set(ids)]));
}

function findMessageById(messages: Message[], id: string): Message | null {
  for (const message of messages) {
    if (message.id === id) return message;
    const nested = message.replies ? findMessageById(message.replies, id) : null;
    if (nested) return nested;
  }
  return null;
}

function updateMessageById(messages: Message[], id: string, update: (message: Message) => Message): Message[] {
  return messages.map((message) => {
    if (message.id === id) return update(message);
    if (!message.replies?.length) return message;
    return { ...message, replies: updateMessageById(message.replies, id, update) };
  });
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState<Screen>('map');
  const [stations, setStations] = useState<Station[]>([]);
  const [curStation, setCurStation] = useState<Station | null>(null);
  const [curCityStations, setCurCityStations] = useState<Station[]>([]);
  const [curSwitchStations, setCurSwitchStations] = useState<Station[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesNextOffset, setMessagesNextOffset] = useState<number | null>(0);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [wallMode, setWallMode] = useState<WallMode>('city');
  const [user, setUser] = useState<User | null>(null);
  const [sortNew, setSortNew] = useState(true);
  const [toast, setToast] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<'page' | 'footprint' | 'message'>('page');
  const [shareTargetMessage, setShareTargetMessage] = useState<Message | null>(null);
  const [footprintStationIds, setFootprintStationIds] = useState<string[]>([]);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [visitorId, setVisitorId] = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionPending = useRef<Set<string>>(new Set());

  const showToast = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1600);
  }, []);

  const refreshStations = useCallback(async () => {
    const s = await listStations();
    setStations(s);
    setCurStation((prev) => (prev ? s.find((x) => x.id === prev.id) ?? null : null));
    setCurCityStations((prev) => prev.length ? s.filter((station) => prev.some((item) => item.id === station.id)) : []);
    setCurSwitchStations((prev) => prev.length ? s.filter((station) => prev.some((item) => item.id === station.id)) : []);
  }, []);

  const fetchMessagesPage = useCallback(async (offset: number, append: boolean) => {
    const opts = { visitorId: visitorId || undefined, limit: MESSAGE_PAGE_SIZE, offset, order: sortNew ? 'desc' as const : 'asc' as const };
    if (wallMode !== 'all' && !curStation) {
      setMessages([]);
      setMessagesNextOffset(null);
      setMessagesHasMore(false);
      return;
    }
    const stationIds = curStation ? (curCityStations.length ? curCityStations.map((station) => station.id) : [curStation.id]) : [];
    const page = wallMode === 'all'
      ? await listAllPublicMessages(opts)
      : stationIds.length > 1
        ? await listMessagesForStations(stationIds, opts)
        : await listMessages(stationIds[0], opts);
    setMessages((current) => {
      if (!append) return page.items;
      const seen = new Set(current.map((message) => message.id));
      return [...current, ...page.items.filter((message) => !seen.has(message.id))];
    });
    setMessagesNextOffset(page.nextOffset);
    setMessagesHasMore(page.hasMore);
  }, [curStation, curCityStations, sortNew, visitorId, wallMode]);

  const refreshMessages = useCallback(async () => {
    setMessagesLoading(true);
    setMessagesNextOffset(0);
    try {
      await fetchMessagesPage(0, false);
    } finally {
      setMessagesLoading(false);
    }
  }, [fetchMessagesPage]);

  const loadMoreMessages = useCallback(async () => {
    if (messagesLoadingMore || !messagesHasMore || messagesNextOffset === null) return;
    setMessagesLoadingMore(true);
    try {
      await fetchMessagesPage(messagesNextOffset, true);
    } finally {
      setMessagesLoadingMore(false);
    }
  }, [fetchMessagesPage, messagesHasMore, messagesLoadingMore, messagesNextOffset]);

  // boot
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2200);
    setVisitorId(getVisitorId());
    setFootprintStationIds(getFootprintStationIds());
    return () => clearTimeout(t);
  }, []);

  // load stations
  useEffect(() => { refreshStations(); }, [refreshStations]);

  // load messages when entering a wall
  useEffect(() => { if (curStation || wallMode === 'all') refreshMessages(); }, [curStation, wallMode, sortNew, refreshMessages]);

  const openWall = useCallback((s: Station) => {
    setWallMode('city');
    setCurStation(s);
    setCurCityStations([s]);
    setCurSwitchStations([]);
    setScreen('wall');
  }, []);

  const openCityWall = useCallback((s: Station, cityStations: Station[], switchStations?: Station[]) => {
    setWallMode('city');
    const uniqueCities = new Map(cityStations.map((station) => [station.cityName, station]));
    setCurStation(s);
    setCurCityStations(uniqueCities.size > 1 ? [s] : cityStations);
    setCurSwitchStations(switchStations ?? (uniqueCities.size > 1 ? [...uniqueCities.values()].sort((a, b) => b.date.localeCompare(a.date)) : []));
    setScreen('wall');
  }, []);

  const backToMap = useCallback(() => setScreen('map'), []);

  const openAllWall = useCallback(async () => {
    setWallMode('all');
    setCurStation(null);
    setCurCityStations([]);
    setCurSwitchStations([]);
    setScreen('wall');
  }, []);

  const login = useCallback(async (name: string, password?: string) => {
    const admin = name.toLowerCase() === 'admin';
    if (admin) {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok && response.status !== 503) {
        showToast('管理员密码不正确');
        return;
      }
    }
    setUser({
      id: 'u' + Date.now(),
      username: name,
      role: admin ? 'admin' : 'fan',
      avatar: admin ? 0 : Math.floor(Math.random() * 5) + 1,
    });
    setLoginOpen(false);
    showToast('欢迎，' + name + (admin ? ' / 管理员' : ''));
  }, [showToast]);

  const logout = useCallback(async () => {
    if (user?.role === 'admin') await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => undefined);
    setUser(null);
    showToast('已退出登录');
  }, [user, showToast]);

  const submitMessage = useCallback(async (input: SubmitMessageInput) => {
    if (!user) throw new Error('请先登录');
    const pickedStation = stations.find((station) => station.name === input.cityTag || station.cityName === input.cityTag);
    const stationId = curStation?.id ?? replyTarget?.stationId ?? pickedStation?.id ?? '';
    if (!stationId && !input.parentId) throw new Error('请先选择城市');
    await createMessage({
      stationId,
      author: user.username,
      avatar: user.avatar,
      body: input.body,
      mood: input.mood,
      rating: input.rating,
      cityTag: input.cityTag,
      image: input.images?.[0] ?? input.image ?? '',
      images: input.images ?? (input.image ? [input.image] : []),
      imageThumbs: input.imageThumbs ?? [],
      parentId: input.parentId ?? null,
    });
    if (stationId) {
      setFootprintStationIds((current) => {
        const next = [...new Set([...current, stationId])];
        saveFootprintStationIds(next);
        return next;
      });
    }
    await refreshMessages();
    await refreshStations();
    setComposerOpen(false);
    setReplyTarget(null);
    showToast('已发布');
  }, [user, curStation, replyTarget, stations, refreshMessages, refreshStations, showToast]);

  const toggleReaction = useCallback(async (messageId: string, type: ReactionType) => {
    const pendingKey = messageId + ':' + type;
    if (reactionPending.current.has(pendingKey)) return;
    reactionPending.current.add(pendingKey);
    const activeVisitorId = visitorId || getVisitorId();
    if (!visitorId) setVisitorId(activeVisitorId);
    const target = findMessageById(messages, messageId);
    if (!target) { reactionPending.current.delete(pendingKey); return; }
    const likedKey = type === 'like' ? 'viewerLiked' : 'viewerHearted';
    const countKey = type === 'like' ? 'likesCount' : 'heartsCount';
    const wasOn = Boolean(target[likedKey]);
    setMessages((current) => updateMessageById(current, messageId, (message) => ({
      ...message,
      [likedKey]: !wasOn,
      [countKey]: Math.max(0, (message[countKey] ?? 0) + (wasOn ? -1 : 1)),
    })));
    try {
      const next = await toggleMessageReaction(messageId, type, activeVisitorId);
      setMessages((current) => updateMessageById(current, messageId, (message) => ({ ...message, ...next })));
    } catch {
      setMessages((current) => updateMessageById(current, messageId, () => target));
      showToast('互动失败，请重试');
    } finally {
      reactionPending.current.delete(pendingKey);
    }
  }, [messages, showToast, visitorId]);

  const openReplyComposer = useCallback((message: Message) => {
    setReplyTarget(message);
    setComposerOpen(true);
  }, []);

  const clearReplyTarget = useCallback(() => setReplyTarget(null), []);

  const refreshAdmin = useCallback(async () => {
    setAllMsgs(await listAllMessages());
    setUsers(await listUsers());
  }, []);

  const openAdmin = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      showToast('请先以管理员身份登录');
      setLoginOpen(true);
      return;
    }
    setScreen('admin');
    await refreshAdmin();
  }, [user, showToast, refreshAdmin]);

  const toggleSort = useCallback(() => setSortNew((v) => !v), []);

  const value: AppContextValue = {
    booted, screen, setScreen,
    stations, refreshStations,
    curStation, curCityStations, curSwitchStations, openWall, openCityWall, backToMap, wallMode, openAllWall, clearReplyTarget,
    messages, refreshMessages, loadMoreMessages, messagesHasMore, messagesLoading, messagesLoadingMore, toggleReaction, sortNew, toggleSort,
    user, login, logout,
    toast, showToast, submitMessage, replyTarget, openReplyComposer, openAdmin, footprintStationIds,
    shareMode, shareTargetMessage, openShareCard: (mode: 'page' | 'footprint' | 'message', message?: Message | null) => {
      setShareMode(mode);
      if (message) setShareTargetMessage(message);
      setShareOpen(true);
    }, closeShareCard: () => {
      setShareOpen(false);
      setShareTargetMessage(null);
    },
    loginOpen, setLoginOpen, composerOpen, setComposerOpen,
    lightbox, setLightbox, shareOpen, setShareOpen,
    allMsgs, users, refreshAdmin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
