import type { Station } from '@chili/shared';

/**
 * 场景包 —— 像素化中国地图（纯 Canvas 2D）。
 *
 * 网格 64×40（宽高比 1.6，接近中国真实经纬比，不变形）。
 * 中国大陆/台湾/海南轮廓由公开 GeoJSON 边界离线栅格化得到（离线
 * 预处理一次，硬编码为 ROWS，运行时零依赖）。地形按经纬度区域分
 * 平原 L / 高原 H / 沙漠 D 三色块，加海岸高光与长江/黄河/珠江点缀。
 *
 * 站点 x/y 是相对此网格的百分比（已吸附到陆地），由前端绘制标记与
 * 巡演路线；本场景只画地形背景。对外 API 不变：后续可换 PixiJS。
 */

export interface MapAdapter {
  onSelectStation?: (stationId: string) => void;
}

export interface TourMapOptions {
  stations: Station[];
  adapter?: MapAdapter;
}

export interface TourMap {
  destroy: () => void;
  redraw: () => void;
}

/** 网格尺寸（列×行） */
export const GRID_W = 64;
export const GRID_H = 40;

type Cell = '.' | 'L' | 'H' | 'D';
const TERRAIN_BASE: Record<Exclude<Cell, '.'>, string> = {
  L: '#2f7d4f', // 平原绿
  H: '#6b6157', // 高原/山地棕
  D: '#d9c388', // 沙漠黄
};

/**
 * 中国轮廓网格（64×40），逐行 run-length 编码 [字符, 连续数]。
 * 由公开省级 GeoJSON 边界离线栅格化生成；经纬范围为 73E-135E, 18N-54N。
 */
type Run = [Cell, number];
const ROWS: Run[][] = [
  [['.', 50], ['L', 3], ['.', 11]],
  [['.', 49], ['L', 6], ['.', 9]],
  [['.', 48], ['L', 8], ['.', 8]],
  [['.', 48], ['L', 8], ['.', 8]],
  [['.', 45], ['L', 12], ['.', 7]],
  [['.', 14], ['D', 2], ['.', 28], ['L', 16], ['.', 4]],
  [['.', 13], ['D', 4], ['.', 27], ['L', 20]],
  [['.', 10], ['D', 1], ['.', 1], ['D', 7], ['.', 27], ['L', 18]],
  [['.', 10], ['D', 9], ['.', 26], ['L', 18], ['.', 1]],
  [['.', 8], ['D', 11], ['.', 24], ['L', 20], ['.', 1]],
  [['.', 7], ['D', 16], ['.', 16], ['L', 21], ['.', 4]],
  [['.', 8], ['D', 16], ['.', 15], ['L', 21], ['.', 4]],
  [['.', 7], ['D', 23], ['.', 8], ['D', 1], ['L', 21], ['.', 4]],
  [['.', 6], ['D', 33], ['L', 19], ['.', 6]],
  [['.', 4], ['D', 35], ['L', 16], ['.', 9]],
  [['.', 1], ['D', 38], ['L', 15], ['.', 10]],
  [['D', 39], ['L', 9], ['.', 1], ['L', 2], ['.', 13]],
  [['.', 1], ['D', 38], ['L', 10], ['.', 15]],
  [['.', 1], ['D', 38], ['L', 12], ['.', 13]],
  [['.', 3], ['D', 36], ['L', 11], ['.', 14]],
  [['.', 3], ['H', 30], ['L', 16], ['.', 15]],
  [['.', 5], ['H', 28], ['L', 16], ['.', 15]],
  [['.', 6], ['H', 27], ['L', 16], ['.', 15]],
  [['.', 6], ['H', 27], ['L', 17], ['.', 14]],
  [['.', 5], ['H', 35], ['L', 11], ['.', 13]],
  [['.', 6], ['H', 34], ['L', 11], ['.', 13]],
  [['.', 8], ['H', 32], ['L', 11], ['.', 13]],
  [['.', 10], ['H', 30], ['L', 11], ['.', 13]],
  [['.', 12], ['H', 28], ['L', 10], ['.', 14]],
  [['.', 16], ['H', 1], ['.', 2], ['H', 4], ['.', 3], ['H', 14], ['L', 9], ['.', 15]],
  [['.', 26], ['H', 14], ['L', 9], ['.', 15]],
  [['.', 26], ['H', 14], ['L', 10], ['.', 14]],
  [['.', 25], ['H', 15], ['L', 11], ['.', 13]],
  [['.', 25], ['H', 15], ['L', 7], ['.', 1], ['L', 2], ['.', 14]],
  [['.', 27], ['H', 13], ['L', 5], ['.', 3], ['L', 2], ['.', 14]],
  [['.', 27], ['H', 3], ['.', 5], ['H', 5], ['L', 3], ['.', 6], ['L', 1], ['.', 14]],
  [['.', 29], ['H', 1], ['.', 8], ['H', 1], ['.', 25]],
  [['.', 38], ['L', 1], ['.', 25]],
  [['.', 36], ['H', 3], ['.', 25]],
  [['.', 37], ['H', 2], ['.', 25]],
];

const GRID: Cell[][] = ROWS.map((runs) => {
  const row: Cell[] = [];
  for (const [ch, n] of runs) row.push(...Array(n).fill(ch));
  return row;
});

/** 河流像素坐标（已校验落在陆地） */
const RIVERS: [number, number][][] = [
  // 长江：宜宾→重庆→武汉→南京→上海
  [[31, 25], [33, 24], [39, 25], [43, 25], [49, 25]],
  // 黄河：源头→兰州→河套→三门峡→济南→渤海
  [[27, 20], [32, 18], [36, 15], [43, 16], [47, 15], [50, 14]],
  // 珠江：广州入海口
  [[42, 33]],
];

function noise(x: number, y: number): number {
  let n = (x * 73856093) ^ (y * 19349663);
  n = (n >>> 0) * 1103515245 + 12345;
  return ((n >>> 0) % 1000) / 1000;
}

function isLand(c: Cell | undefined): c is Exclude<Cell, '.'> {
  return c === 'L' || c === 'H' || c === 'D';
}

export function createTourMap(canvas: HTMLCanvasElement, opts: TourMapOptions): TourMap {
  const ctx = canvas.getContext('2d')!;
  void opts;

  function redraw() {
    const W = (canvas.width = Math.max(1, Math.floor(canvas.clientWidth)));
    const H = (canvas.height = Math.max(1, Math.floor(canvas.clientHeight)));
    const T = Math.min(W / GRID_W, H / GRID_H);
    const ox = (W - GRID_W * T) / 2;
    const oy = (H - GRID_H * T) / 2;

    // 1. 海洋底 + 噪点
    ctx.fillStyle = '#0e1838';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        if (noise(x >> 2, y >> 2) > 0.82) {
          ctx.fillStyle = 'rgba(60,90,150,.25)';
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    const px = (gx: number) => Math.round(ox + gx * T);
    const py = (gy: number) => Math.round(oy + gy * T);

    // 2. 陆地
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const c = GRID[gy][gx];
        if (!isLand(c)) continue;
        const n = noise(gx, gy);
        let fill = TERRAIN_BASE[c];
        if (c === 'L') fill = n > 0.8 ? '#1d5e36' : n > 0.45 ? '#2f7d4f' : '#266b42';
        else if (c === 'H') fill = n > 0.8 ? '#8a7a5e' : n > 0.45 ? '#6b6157' : '#57493c';
        else if (c === 'D') fill = n > 0.8 ? '#c4ab66' : n > 0.45 ? '#d9c388' : '#e3cf9c';
        ctx.fillStyle = fill;
        ctx.fillRect(px(gx), py(gy), Math.ceil(T), Math.ceil(T));
      }
    }

    // 3. 海岸高光：陆地邻海的一侧描浅色边
    ctx.fillStyle = '#e8d8a0';
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (!isLand(GRID[gy][gx])) continue;
        const x0 = px(gx), y0 = py(gy), s = Math.ceil(T);
        if (!isLand(GRID[gy][gx - 1])) ctx.fillRect(x0, y0, 2, s);
        if (!isLand(GRID[gy][gx + 1])) ctx.fillRect(x0 + s - 2, y0, 2, s);
        if (!isLand(GRID[gy - 1]?.[gx])) ctx.fillRect(x0, y0, s, 2);
        if (!isLand(GRID[gy + 1]?.[gx])) ctx.fillRect(x0, y0 + s - 2, s, 2);
      }
    }

    // 4. 河流（青色）
    ctx.fillStyle = '#37d7e2';
    ctx.strokeStyle = '#37d7e2';
    ctx.lineWidth = Math.max(2, T * 0.3);
    ctx.lineCap = 'round';
    for (const river of RIVERS) {
      ctx.beginPath();
      for (let i = 0; i < river.length; i++) {
        const [gx, gy] = river[i];
        const cx = px(gx) + T / 2;
        const cy = py(gy) + T / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
        const r = Math.max(2, T * 0.28);
        ctx.fillRect(Math.round(cx - r), Math.round(cy - r * 0.5), Math.round(r * 2), Math.round(r));
      }
      ctx.stroke();
    }
  }

  redraw();
  const onResize = () => redraw();
  window.addEventListener('resize', onResize);

  return {
    redraw,
    destroy() {
      window.removeEventListener('resize', onResize);
    },
  };
}
