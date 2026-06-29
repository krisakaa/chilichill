'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Message, ReactionType, Station, User } from '@chili/shared';
import { listStations, listMessages, listMessagesForStations, createMessage, listAllMessages, listUsers, toggleMessageReaction } from '@chili/db';

export type Screen = 'map' | 'wall' | 'admin';

export interface SubmitMessageInput {
  body: string;
  mood: string;
  rating: number;
  cityTag: string;
  image?: string;
  images?: string[];
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

  messages: Message[];
  refreshMessages: () => Promise<void>;
  toggleReaction: (messageId: string, type: ReactionType) => Promise<void>;
  sortNew: boolean;
  toggleSort: () => void;

  user: User | null;
  login: (name: string, password?: string) => Promise<void>;
  logout: () => void;

  toast: string;
  showToast: (t: string) => void;
  submitMessage: (input: SubmitMessageInput) => Promise<void>;
  openAdmin: () => Promise<void>;

  // modals
  loginOpen: boolean;
  setLoginOpen: (b: boolean) => void;
  composerOpen: boolean;
  setComposerOpen: (b: boolean) => void;
  lightbox: string | null;
  setLightbox: (s: string | null) => void;

  // admin data
  allMsgs: Message[];
  users: User[];
  refreshAdmin: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const VISITOR_KEY = 'chilichill_visitor_id';

function getVisitorId() {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(VISITOR_KEY, next);
  return next;
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
  const [user, setUser] = useState<User | null>(null);
  const [sortNew, setSortNew] = useState(true);
  const [toast, setToast] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [visitorId, setVisitorId] = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const refreshMessages = useCallback(async () => {
    if (!curStation) { setMessages([]); return; }
    const stationIds = curCityStations.length ? curCityStations.map((station) => station.id) : [curStation.id];
    const opts = visitorId ? { visitorId } : undefined;
    setMessages(stationIds.length > 1 ? await listMessagesForStations(stationIds, opts) : await listMessages(curStation.id, opts));
  }, [curStation, curCityStations, visitorId]);

  // 开机
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2200);
    setVisitorId(getVisitorId());
    return () => clearTimeout(t);
  }, []);

  // 初始加载站点
  useEffect(() => { refreshStations(); }, [refreshStations]);

  // 进入站点时加载留言
  useEffect(() => { if (curStation) refreshMessages(); }, [curStation, refreshMessages]);

  const openWall = useCallback((s: Station) => {
    setCurStation(s);
    setCurCityStations([s]);
    setCurSwitchStations([]);
    setScreen('wall');
  }, []);

  const openCityWall = useCallback((s: Station, cityStations: Station[], switchStations?: Station[]) => {
    const uniqueCities = new Map(cityStations.map((station) => [station.cityName, station]));
    setCurStation(s);
    setCurCityStations(uniqueCities.size > 1 ? [s] : cityStations);
    setCurSwitchStations(switchStations ?? (uniqueCities.size > 1 ? [...uniqueCities.values()].sort((a, b) => b.date.localeCompare(a.date)) : []));
    setScreen('wall');
  }, []);

  const backToMap = useCallback(() => setScreen('map'), []);

  const login = useCallback(async (name: string, password?: string) => {
    const admin = name.toLowerCase() === 'admin';
    if (admin) {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok && response.status !== 503) {
        showToast('管理员密码错误');
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
    showToast('欢迎，' + name + (admin ? ' · 管理员' : ''));
  }, [showToast]);

  const logout = useCallback(async () => {
    if (user?.role === 'admin') await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => undefined);
    setUser(null);
    showToast('已退出');
  }, [user, showToast]);

  const submitMessage = useCallback(async (input: SubmitMessageInput) => {
    if (!user || !curStation) return;
    await createMessage({
      stationId: curStation.id,
      author: user.username,
      avatar: user.avatar,
      body: input.body,
      mood: input.mood,
      rating: input.rating,
      cityTag: input.cityTag,
      image: input.images?.[0] ?? input.image ?? '',
      images: input.images ?? (input.image ? [input.image] : []),
    });
    await refreshMessages();
    await refreshStations();
    setComposerOpen(false);
    showToast('已发布');
  }, [user, curStation, refreshMessages, refreshStations, showToast]);

  const toggleReaction = useCallback(async (messageId: string, type: ReactionType) => {
    const activeVisitorId = visitorId || getVisitorId();
    if (!visitorId) setVisitorId(activeVisitorId);
    const target = messages.find((message) => message.id === messageId);
    if (!target) return;
    const likedKey = type === 'like' ? 'viewerLiked' : 'viewerHearted';
    const countKey = type === 'like' ? 'likesCount' : 'heartsCount';
    const wasOn = Boolean(target[likedKey]);
    setMessages((current) => current.map((message) => message.id === messageId ? {
      ...message,
      [likedKey]: !wasOn,
      [countKey]: Math.max(0, (message[countKey] ?? 0) + (wasOn ? -1 : 1)),
    } : message));
    try {
      const next = await toggleMessageReaction(messageId, type, activeVisitorId);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, ...next } : message));
    } catch {
      setMessages((current) => current.map((message) => message.id === messageId ? target : message));
      showToast('浜掑姩澶辫触锛岃绋嶅悗閲嶈瘯');
    }
  }, [messages, showToast, visitorId]);

  const refreshAdmin = useCallback(async () => {
    setAllMsgs(await listAllMessages());
    setUsers(await listUsers());
  }, []);

  const openAdmin = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      showToast('需要管理员登录');
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
    curStation, curCityStations, curSwitchStations, openWall, openCityWall, backToMap,
    messages, refreshMessages, toggleReaction, sortNew, toggleSort,
    user, login, logout,
    toast, showToast, submitMessage, openAdmin,
    loginOpen, setLoginOpen, composerOpen, setComposerOpen,
    lightbox, setLightbox,
    allMsgs, users, refreshAdmin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
