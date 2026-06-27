import type { Mood } from '@chili/shared';

/**
 * 像素小人绘制 —— 占位实现。
 *
 * 等真实小人素材到位后，把 drawNpc 替换为像素精灵帧绘制即可，
 * 调用点（开机动画、空状态、官方头像）全部自动生效。
 *
 * @param frame 用于逐帧动画的帧索引
 */
export function drawNpc(canvas: HTMLCanvasElement, frame = 0): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const T = canvas.width / 8;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bob = frame % 2 ? 0 : 1;

  // 占位小人 8x8（后续替换为 ChiliChill 官方小人精灵）
  const P = [
    '....AA..',
    '...AAAA.',
    '..AAAAAA',
    '..AWWAA.',
    '..AAAAA.',
    '...BBB..',
    '...B..B.',
    '...B..B.',
  ];
  const C: Record<string, string> = { A: '#ff4d6d', W: '#fff', B: '#2a1b54' };
  P.forEach((row, y) =>
    row.split('').forEach((c, x) => {
      if (C[c]) {
        ctx.fillStyle = C[c];
        ctx.fillRect(x * T, (y + bob) * T, T, T);
      }
    }),
  );
}

/** 把一张图片像素化：降采样 + 最近邻放大。返回 dataURL。 */
export function pixelateImage(img: HTMLImageElement, target = 64): string {
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, Math.floor(target / 8));
  canvas.width = target * scale;
  canvas.height = Math.floor((img.height / img.width) * target) * scale || target * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // 先缩到 target 再放大
  const tmp = document.createElement('canvas');
  tmp.width = target;
  tmp.height = Math.floor((img.height / img.width) * target) || target;
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** 时间相对格式化 */
export function fmtTime(t: number): string {
  const d = Date.now() - t;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + '分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + '小时前';
  if (d < 7 * 86400000) return Math.floor(d / 86400000) + '天前';
  return new Date(t).toLocaleDateString('zh-CN');
}

/** 星星评分渲染 HTML */
export function renderStars(rating: number): string {
  return '★'.repeat(rating) + '<span class="off">' + '★'.repeat(5 - rating) + '</span>';
}

/** 默认心情列表（最终替换为小人表情包） */
export const DEFAULT_MOODS: Mood[] = ['🔥燃', '😭破防', '💕心动', '✨梦幻'];
