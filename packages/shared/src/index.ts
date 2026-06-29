/**
 * ChiliChill 巡演像素日记 — 共享类型与常量
 * Web 与 App、各包之间复用的领域模型。
 */

/** 站点状态 */
export type StationStatus = 'upcoming' | 'live' | 'done';

/** 站点主题色 key（绑定专辑/小人主题色） */
export type Palette =
  | 'hot' // 品红
  | 'cool' // 青
  | 'gold' // 金
  | 'violet' // 紫
  | 'green' // 绿
  | 'warn'; // 橙

/** 留言状态 */
export type MessageStatus = 'published' | 'pending' | 'hidden';
export type ReactionType = 'like' | 'heart';

/** 用户角色 */
export type UserRole = 'fan' | 'admin';

/** 心情 key（最终替换为小人表情包帧） */
export type Mood = '🔥燃' | '😭破防' | '💕心动' | '✨梦幻';

/** 巡演站点 */
export interface Station {
  id: string;
  code: string; // 地图标记缩写
  name: string; // 展示名，默认同城市名
  cityName: string; // 城市名，用于同城多场合并
  provinceName: string; // 省级行政区名，用于地图高亮
  provinceAdcode?: number; // 省级行政区 adcode，用于稳定匹配 GeoJSON
  venue: string; // 演出场馆
  date: string; // YYYY-MM-DD
  x: number; // 地图坐标百分比 0-100
  y: number; // 地图坐标百分比 0-100
  status: StationStatus;
  palette: Palette;
  count?: number; // 粉丝日记数（派生）
}

/** 留言 */
export interface Message {
  id: string;
  stationId: string | null;
  parentId?: string | null;
  author: string;
  authorId?: string;
  avatar: number; // 头像样式索引；0 = 官方小人专属
  official: boolean;
  body: string;
  mood: Mood | string;
  rating: number; // 0-5
  cityTag: string;
  image: string; // 兼容旧单图 URL（可空）
  images?: string[]; // 留言图片 URL 列表
  likesCount?: number;
  heartsCount?: number;
  viewerLiked?: boolean;
  viewerHearted?: boolean;
  replies?: Message[];
  status: MessageStatus;
  createdAt: number;
}

/** 用户 */
export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar: number;
}

/** 调色板 hex 映射 */
export const PALETTES: Record<Palette, string> = {
  hot: '#ff4d6d',
  cool: '#37d7e2',
  gold: '#ffd23f',
  violet: '#b388ff',
  green: '#7cf28a',
  warn: '#ff9f43',
};

export const STATUS_LABEL: Record<StationStatus, string> = {
  live: '进行中',
  upcoming: '即将开演',
  done: '已结束',
};

export const MOODS: Mood[] = ['🔥燃', '😭破防', '💕心动', '✨梦幻'];
