import type { Message, Station, User } from '@chili/shared';

/**
 * 种子数据。后端接入后由 Supabase 提供。
 * 站点 x/y 为相对像素中国地图网格(64×40)的百分比，已吸附到陆地格。
 */
export const SEED_STATIONS: Station[] = [
  { id: 's1', code: 'SH', name: '上海', cityName: '上海', provinceName: '上海市', provinceAdcode: 310000, venue: '梅赛德斯-奔驰文化中心', date: '2026-05-17', x: 78.6, y: 53.8, status: 'done', palette: 'hot' },
  { id: 's2', code: 'BJ', name: '北京', cityName: '北京', provinceName: '北京市', provinceAdcode: 110000, venue: '国家体育场', date: '2026-06-07', x: 62.7, y: 30.8, status: 'done', palette: 'cool' },
  { id: 's3', code: 'GZ', name: '广州', cityName: '广州', provinceName: '广东省', provinceAdcode: 440000, venue: '宝能体育中心', date: '2026-06-21', x: 57.9, y: 79.7, status: 'live', palette: 'gold' },
  { id: 's4', code: 'CD', name: '成都', cityName: '成都', provinceName: '四川省', provinceAdcode: 510000, venue: '凤凰山体育馆', date: '2026-07-05', x: 38.9, y: 59.4, status: 'upcoming', palette: 'violet' },
  { id: 's5', code: 'WH', name: '武汉', cityName: '武汉', provinceName: '湖北省', provinceAdcode: 420000, venue: '五环体育中心', date: '2026-07-19', x: 60.4, y: 61.6, status: 'upcoming', palette: 'green' },
];

const now = Date.now();
export const SEED_MESSAGES: Message[] = [
  { id: 'm1', stationId: 's1', author: '辣条不加辣', avatar: 1, official: false, body: 'ChiliChill返场的时候整个场馆都在哭，那首《发光曲线》前奏一响我眼泪就下来了。这辈子值了。', mood: '🔥燃', rating: 5, cityTag: '上海', image: 'https://picsum.photos/seed/chili1/320/180', status: 'published', createdAt: now - 3 * 3600000 },
  { id: 'm2', stationId: 's1', author: '鼓棒断了三根', avatar: 2, official: false, body: '后排视角依然震撼，鼓组清晰得像在耳边敲。散场后在门口和陌生人合唱了一路。', mood: '✨梦幻', rating: 5, cityTag: '上海', image: '', status: 'published', createdAt: now - 5 * 3600000 },
  { id: 'm3', stationId: 's1', author: 'ChiliChill 官方', avatar: 0, official: true, body: '感谢上海站所有到场的你们，你们的合唱是我们听过最美的和声。下一站，广州见。', mood: '💕心动', rating: 5, cityTag: '上海', image: 'https://picsum.photos/seed/official1/320/180', status: 'published', createdAt: now - 2 * 3600000 },
  { id: 'm4', stationId: 's2', author: '鸟巢附近迷路', avatar: 4, official: false, body: '北京场设备出了一点小状况，结果乐团现场即兴了一首没听过的曲子，全场沸腾。', mood: '😭破防', rating: 5, cityTag: '北京', image: '', status: 'published', createdAt: now - 2 * 86400000 },
  { id: 'm5', stationId: 's2', author: '热到融化', avatar: 1, official: false, body: '第一次看现场，原来live和耳机里完全不是一个东西。已原地入坑。', mood: '🔥燃', rating: 4, cityTag: '北京', image: 'https://picsum.photos/seed/chili2/320/180', status: 'published', createdAt: now - 86400000 },
  { id: 'm6', stationId: 's3', author: '雨中即兴', avatar: 3, official: false, body: '广州的雨说下就下，结果雨中演出更燃了，灯光打在雨幕上像极光。', mood: '✨梦幻', rating: 5, cityTag: '广州', image: '', status: 'published', createdAt: now - 3600000 },
  { id: 'm7', stationId: 's3', author: '路过游客', avatar: 5, official: false, body: '不太喜欢，太吵了。', mood: '🔥燃', rating: 2, cityTag: '广州', image: '', status: 'hidden', createdAt: now - 1800000 },
];

export const SEED_USERS: User[] = [
  { id: 'u1', username: '辣条不加辣', role: 'fan', avatar: 1 },
  { id: 'u2', username: '鼓棒断了三根', role: 'fan', avatar: 2 },
  { id: 'u3', username: 'admin', role: 'admin', avatar: 0 },
];
