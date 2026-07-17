'use client';

import { useMemo, useState } from 'react';
import { useApp } from '../store';

type ShareMode = 'page' | 'footprint';

const CARD_W = 1080;
const CARD_H = 1440;

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = [...text];
  let line = '';
  let lines = 0;
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = char;
      lines += 1;
      if (lines >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

function drawPixelGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#160f2d';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = 'rgba(244,231,211,.08)';
  ctx.lineWidth = 2;
  for (let x = 0; x < CARD_W; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 8;
  ctx.strokeRect(42, 42, CARD_W - 84, CARD_H - 84);
  ctx.strokeStyle = '#0a0518';
  ctx.lineWidth = 12;
  ctx.strokeRect(64, 64, CARD_W - 128, CARD_H - 128);
}

function drawHeader(ctx: CanvasRenderingContext2D, subtitle: string) {
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('ChiliChill', 90, 150);
  ctx.fillStyle = '#37d7e2';
  ctx.font = '28px sans-serif';
  ctx.fillText(subtitle, 94, 196);
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

export function ShareModal() {
  const { shareOpen, setShareOpen, stations, messages, wallMode, curStation, footprintStationIds, user, showToast } = useApp();
  const [mode, setMode] = useState<ShareMode>('page');
  const footprintStations = useMemo(() => stations.filter((station) => footprintStationIds.includes(station.id)), [footprintStationIds, stations]);

  if (!shareOpen) return null;

  const title = mode === 'page'
    ? (wallMode === 'all' ? '全站巡演日记' : `${curStation?.cityName ?? '巡演'}站日记`)
    : `${user?.username ?? '我'}的巡演足迹`;
  const countText = mode === 'page'
    ? `${messages.length} 篇现场日记已装入这张卡`
    : `点亮 ${footprintStations.length} 座城市`;
  const cityText = mode === 'page'
    ? (wallMode === 'all' ? '全部城市 / 全部场次' : `${curStation?.venue ?? ''} / ${curStation?.date ?? ''}`)
    : (footprintStations.map((station) => station.cityName).join(' / ') || '写下第一篇日记后点亮城市');

  const generate = () => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPixelGrid(ctx);
    drawHeader(ctx, mode === 'page' ? '巡演日记分享卡' : '我的巡演足迹卡');

    ctx.fillStyle = '#f4e7d3';
    ctx.font = 'bold 70px sans-serif';
    wrapText(ctx, title, 90, 340, 900, 86, 3);

    ctx.fillStyle = '#7cf28a';
    ctx.font = 'bold 46px sans-serif';
    wrapText(ctx, countText, 90, 620, 900, 58, 2);

    ctx.fillStyle = '#b1a0cc';
    ctx.font = '34px sans-serif';
    wrapText(ctx, cityText, 90, 730, 900, 48, 6);

    const dots = mode === 'footprint' ? footprintStations : (curStation ? [curStation] : stations.slice(0, 6));
    dots.slice(0, 12).forEach((station, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 120 + col * 225;
      const y = 970 + row * 112;
      ctx.fillStyle = ['#ff4d6d', '#37d7e2', '#ffd23f', '#7cf28a'][index % 4];
      ctx.fillRect(x, y, 38, 38);
      ctx.fillStyle = '#f4e7d3';
      ctx.font = '28px sans-serif';
      ctx.fillText(station.cityName, x + 54, y + 31);
    });

    ctx.fillStyle = '#ffd23f';
    ctx.font = '30px sans-serif';
    ctx.fillText('扫码或打开网站，留下你的现场记忆', 90, 1320);
    downloadCanvas(canvas, mode === 'page' ? 'chilichill-share-card.png' : 'chilichill-footprint-card.png');
    showToast('分享卡已生成');
  };

  return (
    <div className="modal active" id="share-modal">
      <div className="sheet share-sheet">
        <h3>分享卡</h3>
        <div className="login-tabs">
          <button className={mode === 'page' ? 'on' : ''} onClick={() => setMode('page')}>当前页面</button>
          <button className={mode === 'footprint' ? 'on' : ''} onClick={() => setMode('footprint')}>我的足迹</button>
        </div>
        <div className="share-preview">
          <span>{mode === 'page' ? 'DIARY CARD' : 'FOOTPRINT'}</span>
          <b>{title}</b>
          <p>{countText}</p>
          <em>{cityText}</em>
        </div>
        <div className="actions">
          <button className="btn cancel" onClick={() => setShareOpen(false)}>取消</button>
          <button className="btn post" onClick={generate}>生成 PNG</button>
        </div>
      </div>
    </div>
  );
}
