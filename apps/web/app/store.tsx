'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Message, Station, User } from '@chili/shared';
import { listStations, listMessages, listMessagesForStations, createMessage, listAllMessages, listUsers } from '@chili/db';

export type Screen = 'map' | 'wall' | 'admin';

export interface SubmitMessageInput {
  body: string;
  mood: string;
  rating: number;
  cityTag: string;
  image?: string;
}

interface AppContextValue {
  booted: boolean;
  screen: Screen;
  setScreen: (s: Screen) => void;

  stations: Station[];
  refreshStations: () => Promise<void>;

  curStation: Station | null;
  curCityStations: Station[];
  openWall: (s: Station) => void;
  openCityWall: (s: Station, cityStations: Station[]) => void;
  backToMap: () => void;

  messages: Message[];
  refreshMessages: () => Promise<void>;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [sortNew, setSortNew] = useState(true);
  const [toast, setToast] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!curStation) { setMessages([]); return; }
    const stationIds = curCityStations.length ? curCityStations.map((station) => station.id) : [curStation.id];
    setMessages(stationIds.length > 1 ? await listMessagesForStations(stationIds) : await listMessages(curStation.id));
  }, [curStation, curCityStations]);

  // 开机
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // 初始加载站点
  useEffect(() => { refreshStations(); }, [refreshStations]);

  // 进入站点时加载留言
  useEffect(() => { if (curStation) refreshMessages(); }, [curStation, refreshMessages]);

  const openWall = useCallback((s: Station) => {
    setCurStation(s);
    setCurCityStations([s]);
    setScreen('wall');
  }, []);

  const openCityWall = useCallback((s: Station, cityStations: Station[]) => {
    setCurStation(s);
    setCurCityStations(cityStations);
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
      image: input.image ?? '',
    });
    await refreshMessages();
    await refreshStations();
    setComposerOpen(false);
    showToast('已提交，等待审核');
  }, [user, curStation, refreshMessages, refreshStations, showToast]);

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
    curStation, curCityStations, openWall, openCityWall, backToMap,
    messages, refreshMessages, sortNew, toggleSort,
    user, login, logout,
    toast, showToast, submitMessage, openAdmin,
    loginOpen, setLoginOpen, composerOpen, setComposerOpen,
    lightbox, setLightbox,
    allMsgs, users, refreshAdmin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
