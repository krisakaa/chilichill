'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PALETTES, type Message } from '@chili/shared';
import { useApp } from '../store';

type ShareMode = 'page' | 'footprint' | 'message';

const CARD_W = 1080;
const CARD_H = 1440;

/* ===== 像素风二维码生成（可用作占位，真实QR需引入库） ===== */
function drawPixelQR(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: string) {
  const cells = 25;
  const cell = size / cells;
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(x, y, size, size);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const rng = () => { hash = ((hash * 16807) % 2147483647); return (hash & 0x7fffffff) / 0x7fffffff; };
  ctx.fillStyle = '#f4e7d3';
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) if (rng() > 0.48) ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
  const drawFinder = (ox: number, oy: number) => {
    ctx.fillStyle = '#0a0518'; ctx.fillRect(x + ox * cell, y + oy * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#f4e7d3'; ctx.fillRect(x + (ox + 1) * cell, y + (oy + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#0a0518'; ctx.fillRect(x + (ox + 2) * cell, y + (oy + 2) * cell, 3 * cell, 3 * cell);
  };
  drawFinder(0, 0); drawFinder(cells - 7, 0); drawFinder(0, cells - 7);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, size, size);
}

/* ===== 文字自动换行 ===== */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const chars = [...text]; let line = ''; let lines = 0;
  for (const c of chars) {
    const next = line + c;
    if (ctx.measureText(next).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH); line = c; lines++;
      if (lines >= maxLines) return;
    } else { line = next; }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

/* ===== 画一个像素风的复古游戏机外壳 ===== */
function drawRetroFrame(ctx: CanvasRenderingContext2D) {
  const pad = 48; const w = CARD_W - pad * 2; const h = CARD_H - pad * 2;
  ctx.fillStyle = '#0e081c'; ctx.fillRect(pad, pad, w, h);
  const inset = 12;
  ctx.fillStyle = '#160f2d'; ctx.fillRect(pad + inset, pad + inset, w - inset * 2, h - inset * 2);
  // Corner accents
  ctx.fillStyle = '#ffd23f';
  [[pad + 8, pad + 8], [pad + w - 20, pad + 8], [pad + 8, pad + h - 20], [pad + w - 20, pad + h - 20]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, 12, 12));
  // Scan lines
  ctx.globalAlpha = 0.06;
  for (let y = pad + inset; y < pad + h - inset; y += 4) { ctx.fillStyle = '#000'; ctx.fillRect(pad + inset, y, w - inset * 2, 1); }
  ctx.globalAlpha = 1;
}

/* ===== 画一条像素风装饰分隔线 ===== */
function drawPixelDivider(ctx: CanvasRenderingContext2D, y: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const dashLen = 8; const gapLen = 6;
  for (let x = 90; x < CARD_W - 90; x += dashLen + gapLen) {
    ctx.fillRect(x, y, dashLen, 2);
  }
}

/* ===== 画星星评分 ===== */
function drawStars(ctx: CanvasRenderingContext2D, rating: number, x: number, y: number) {
  ctx.font = '32px "Press Start 2P", monospace';
  const filled = '★'.repeat(rating);
  const empty = '☆'.repeat(5 - rating);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(filled, x, y);
  ctx.fillStyle = 'rgba(244,231,211,0.3)';
  ctx.fillText(empty, x + ctx.measureText(filled).width, y);
}

/* ===== 下载 ===== */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

export function ShareModal() {
  const { shareOpen, setShareOpen, shareMode, shareTargetMessage, stations, messages, wallMode, curStation, footprintStationIds, user, showToast } = useApp();
  const [mode, setMode] = useState<ShareMode>(shareMode);
  const [generating, setGenerating] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const footprintStations = stations.filter((s) => footprintStationIds.includes(s.id));
  const myMessages = messages.filter((m) => user && m.author === user.username);

  useEffect(() => { setMode(shareMode); }, [shareMode]);

  if (!shareOpen && !closingRef.current) return null;

  const handleClose = useCallback(() => {
    closingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { closingRef.current = false; setShareOpen(false); }, 250);
  }, [setShareOpen]);

  /* ===== 卡片内容计算 ===== */
  const title = mode === 'message' && shareTargetMessage
    ? `${shareTargetMessage.author}的现场日记`
    : mode === 'page'
      ? (wallMode === 'all' ? '全站巡演日记' : `${curStation?.cityName ?? '巡演'}站日记`)
      : `${user?.username ?? '我'}的巡演足迹`;

  const countText = mode === 'message' && shareTargetMessage
    ? `${shareTargetMessage.cityTag} · ${new Date(shareTargetMessage.createdAt).toLocaleDateString('zh-CN')}`
    : mode === 'page'
      ? `${messages.length} 篇现场日记`
      : `点亮 ${footprintStations.length} 座城市 · 发了 ${myMessages.length} 篇日记`;

  /* ===== 生成 PNG ===== */
  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    await document.fonts.ready;
    try {
      await document.fonts.load('900 48px "Press Start 2P"');
      await document.fonts.load('24px "Press Start 2P"');
    } catch { /* ignore */ }

    const canvas = document.createElement('canvas');
    canvas.width = CARD_W; canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setGenerating(false); return; }

    // Background
    ctx.fillStyle = '#0e081c'; ctx.fillRect(0, 0, CARD_W, CARD_H);
    drawRetroFrame(ctx);
    const cx = CARD_W / 2;
    let curY = 130;

    // === BRAND ===
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 52px "Press Start 2P", "ZCOOL KuaiLe", sans-serif';
    ctx.fillText('CHILICHILL', cx, curY);
    ctx.font = '24px "Press Start 2P", "ZCOOL KuaiLe", sans-serif';
    ctx.fillStyle = '#37d7e2';
    const subTitle = mode === 'message' ? 'FIELD NOTE' : mode === 'page' ? 'TOUR DIARY' : 'MY FOOTPRINT';
    ctx.fillText(subTitle, cx, curY + 48);
    ctx.textAlign = 'left';
    curY += 100;

    // === DIVIDER ===
    drawPixelDivider(ctx, curY, 'rgba(244,231,211,0.2)');
    curY += 30;

    if (mode === 'message' && shareTargetMessage) {
      // ===== 单条日记分享卡 =====
      const msg = shareTargetMessage;

      // Author badge
      ctx.fillStyle = '#f4e7d3';
      ctx.font = '28px "Press Start 2P", sans-serif';
      ctx.fillText(`@${msg.author}`, 90, curY);
      curY += 40;

      // Mood + Rating
      ctx.fillStyle = PALETTES[typeof msg.mood === 'string' && msg.mood.startsWith('#') ? 'hot' : 'cool'];
      ctx.font = '900 42px "ZCOOL KuaiLe", sans-serif';
      ctx.fillText(`${msg.mood}`, 90, curY);
      drawStars(ctx, msg.rating, 90 + ctx.measureText(`${msg.mood} `).width + 20, curY);
      curY += 60;

      // Body text (with larger font)
      ctx.fillStyle = '#f4e7d3';
      ctx.font = '900 48px "ZCOOL KuaiLe", "Press Start 2P", sans-serif';
      wrapText(ctx, msg.body, 90, curY, CARD_W - 180, 62, 6);
      const bodyLines = Math.min(6, Math.ceil(msg.body.length / 18));
      curY += 50 + bodyLines * 62;

      // Image thumbnail indicator
      if ((msg.images?.length ?? 0) > 0 || msg.image) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = '20px "Press Start 2P", sans-serif';
        ctx.fillText(`📷 ${msg.images?.length ?? 1} 张现场照片`, 90, curY);
        curY += 40;
      }

      // Reactions
      ctx.fillStyle = '#7cf28a';
      ctx.font = '24px "Press Start 2P", sans-serif';
      ctx.fillText(`👍 ${msg.likesCount ?? 0}    ❤️ ${msg.heartsCount ?? 0}`, 90, curY);
      curY += 50;

      // Date + City
      ctx.fillStyle = '#b1a0cc';
      ctx.font = '24px "Press Start 2P", sans-serif';
      const dateStr = new Date(msg.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      ctx.fillText(`${dateStr} · ${msg.cityTag}`, 90, curY);
      curY += 50;

    } else {
      // ===== 页面 / 足迹 分享卡 =====
      // Big number badge
      const bigNumber = mode === 'page'
        ? String(messages.length)
        : mode === 'footprint'
          ? String(myMessages.length)
          : '0';
      ctx.fillStyle = '#ffd23f';
      ctx.font = '900 120px "Press Start 2P", sans-serif';
      const numW = ctx.measureText(bigNumber).width;
      ctx.fillText(bigNumber, cx - numW / 2, curY + 80);

      ctx.fillStyle = '#f4e7d3';
      ctx.font = '28px "Press Start 2P", sans-serif';
      const unit = mode === 'page' ? '篇日记' : mode === 'footprint' ? '篇日记' : '';
      const unitW = ctx.measureText(unit).width;
      ctx.fillText(unit, cx - unitW / 2, curY + 130);
      curY += 160;

      // Stats line
      ctx.fillStyle = '#7cf28a';
      ctx.font = '900 36px "ZCOOL KuaiLe", "Press Start 2P", sans-serif';
      wrapText(ctx, countText, 90, curY, CARD_W - 180, 48, 2);
      curY += 80;

      // City text
      ctx.fillStyle = '#b1a0cc';
      ctx.font = '28px "ZCOOL KuaiLe", "Press Start 2P", sans-serif';
      const cityText = mode === 'page'
        ? (wallMode === 'all' ? '全部城市 / 全部场次' : `${curStation?.venue ?? ''} / ${curStation?.date ?? ''}`)
        : (footprintStations.map((s) => s.cityName).join(' / ') || '写下第一篇日记后点亮城市');
      wrapText(ctx, cityText, 90, curY, CARD_W - 180, 42, 3);
      curY += 60;

      // City Dots Grid
      const dots = mode === 'footprint' ? footprintStations : (curStation ? [curStation] : stations.slice(0, 6));
      const dotColors = ['#ff4d6d', '#37d7e2', '#ffd23f', '#7cf28a', '#b388ff', '#ff9f43'];
      const startX = 90;
      const colW = (CARD_W - 180 - 40) / 4;
      dots.slice(0, 12).forEach((station, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const dx = startX + col * colW;
        const dy = curY + row * 90;
        ctx.fillStyle = dotColors[index % dotColors.length];
        ctx.fillRect(dx, dy, 36, 36);
        ctx.fillStyle = 'rgba(10,5,24,0.5)';
        ctx.fillRect(dx + 4, dy + 4, 36, 36);
        ctx.fillStyle = dotColors[index % dotColors.length];
        ctx.fillRect(dx, dy, 36, 36);
        ctx.fillStyle = '#f4e7d3';
        ctx.font = '24px "ZCOOL KuaiLe", sans-serif';
        ctx.fillText(station.cityName, dx + 50, dy + 28);
      });
      curY += Math.ceil(Math.min(dots.length, 12) / 4) * 90 + 20;
    }

    // === QR Code ===
    const qrY = CARD_H - 260;
    drawPixelQR(ctx, 90, qrY, 180, seedForQR(mode, user?.username, shareTargetMessage?.id));
    ctx.fillStyle = '#b1a0cc';
    ctx.font = '20px "Press Start 2P", "ZCOOL KuaiLe", sans-serif';
    ctx.fillText('扫码查看', 300, qrY + 60);
    ctx.fillText('chilichill.vercel.app', 300, qrY + 100);

    // === Footer ===
    ctx.fillStyle = 'rgba(177,160,204,0.4)';
    ctx.font = '16px "Press Start 2P", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHILICHILL TOUR DIARY', cx, CARD_H - 60);
    ctx.textAlign = 'left';

    downloadCanvas(canvas, mode === 'message' ? 'chilichill-note-card.png' : mode === 'footprint' ? 'chilichill-footprint-card.png' : 'chilichill-share-card.png');
    showToast('分享卡已生成');
    setGenerating(false);
  };

  function seedForQR(mode: string, username?: string, messageId?: string | null) {
    return `${mode}-${username ?? 'guest'}-${messageId ?? Date.now()}`;
  }

  return (
    <div className={`modal ${closingRef.current ? 'closing' : 'active'}`} id="share-modal" onClick={handleClose}>
      <div className="sheet share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="sheet-avatar">📤</div>
          <h3>分享卡</h3>
          <button className="sheet-close" onClick={handleClose} aria-label="关闭">✕</button>
        </div>
        <div className="login-tabs">
          <button className={mode === 'page' ? 'on' : ''} onClick={() => setMode('page')}>当前页面</button>
          <button className={mode === 'footprint' ? 'on' : ''} onClick={() => setMode('footprint')}>我的足迹</button>
        </div>
        <div className="share-preview">
          <span>{mode === 'message' ? 'FIELD NOTE' : mode === 'page' ? 'DIARY CARD' : 'FOOTPRINT'}</span>
          <b>{title}</b>
          <p>{countText}</p>
          {mode === 'message' && shareTargetMessage && (
            <div className="share-msg-preview">
              <em>{shareTargetMessage.body.substring(0, 80)}{shareTargetMessage.body.length > 80 ? '...' : ''}</em>
              <small>👍 {shareTargetMessage.likesCount ?? 0} · ❤️ {shareTargetMessage.heartsCount ?? 0}</small>
            </div>
          )}
        </div>
        <div className="actions">
          <button className="btn cancel" onClick={handleClose} disabled={generating}>取消</button>
          <button className="btn post" onClick={generate} disabled={generating}>{generating ? '生成中...' : '生成 PNG'}</button>
        </div>
      </div>
    </div>
  );
}
