/**
 * @chili/assets
 *
 * 美术素材包。所有像素美术 PNG 落在 src/images/，本文件仅声明元数据
 * （路径 / 尺寸 / 帧数 / 帧排布），供 drawNpc() 等消费方读取。
 *
 * 素材需求与命名规范见项目根 docs/美术需求文档.md。
 * 当前为占位声明 —— 美术交付 PNG 后，把文件放进 src/images/ 即可，
 * 路径与下面 ASSET_PATHS 保持一致，调用方无需改动。
 */

/** 单帧像素素材尺寸 */
export const SIZE = {
  NPC: 48, // 小人画布 48×48
  MOOD: 32, // 心情表情包 32×32
  LOGO_MAIN: { w: 128, h: 32 },
} as const;

/** 小人动作 spritesheet 元数据：横向排列 N 帧，每帧 SIZE.NPC 宽 */
export interface NpcSheet {
  /** 相对包根的图片路径（消费方按需拼接 import 路径） */
  path: string;
  /** 帧数 */
  frames: number;
  /** 每帧宽 px（= SIZE.NPC） */
  frameW: number;
  /** 每帧高 px（= SIZE.NPC） */
  frameH: number;
  /** 建议播放帧率 */
  fps: number;
  /** 是否循环 */
  loop: boolean;
}

export const NPC_SHEETS = {
  /** 站立呼吸 · 地图待机 · 2 帧循环 */
  idle: { path: 'npc-idle.png', frames: 2, frameW: SIZE.NPC, frameH: SIZE.NPC, fps: 2, loop: true } satisfies NpcSheet,
  /** 招手 · 地图引导点击 · 4 帧循环 */
  wave: { path: 'npc-wave.png', frames: 4, frameW: SIZE.NPC, frameH: SIZE.NPC, fps: 10, loop: true } satisfies NpcSheet,
  /** 墙角探头 · 留言墙空状态 · 2 帧往返 */
  peek: { path: 'npc-peek.png', frames: 2, frameW: SIZE.NPC, frameH: SIZE.NPC, fps: 4, loop: true } satisfies NpcSheet,
  /** 跳跃庆祝 · 发布留言成功 · 4 帧单次 */
  celebrate: { path: 'npc-celebrate.png', frames: 4, frameW: SIZE.NPC, frameH: SIZE.NPC, fps: 10, loop: false } satisfies NpcSheet,
  /** 官方头像 · 乐队官方留言 · 1 帧（金描边） */
  avatar: { path: 'npc-avatar.png', frames: 1, frameW: SIZE.NPC, frameH: SIZE.NPC, fps: 0, loop: false } satisfies NpcSheet,
} as const;

export type NpcAction = keyof typeof NPC_SHEETS;

/** 心情表情包（替代 emoji），每个 1 帧 32×32 */
export const MOODS_ASSETS = {
  fire: 'mood-fire.png', // 燃
  break: 'mood-break.png', // 破防
  love: 'mood-love.png', // 心动
  dream: 'mood-dream.png', // 梦幻
} as const;

/** Logo 字标 */
export const LOGO_ASSETS = {
  main: 'logo-main.png', // 带描边投影
  flat: 'logo-flat.png', // 纯色无投影（favicon）
  white: 'logo-white.png', // 纯白单色（深色场景）
} as const;

/** 统一调色板（与 docs/美术需求文档.md 一致） */
export const PALETTE = {
  bgDeep: '#1A0B2E',
  magenta: '#FF3CAC',
  cyan: '#22D3EE',
  gold: '#FFD23F',
  green: '#5BE584',
  purple: '#9D4EDD',
  white: '#F8F4FF',
  outline: '#0A0418',
} as const;
