'use client';

import { drawNpc } from '@chili/ui';

export function BootScreen() {
  return (
    <div className="boot">
      <div className="boot-logo">ChiliChill<small>TOUR DIARY</small></div>
      <div className="boot-bar"><i /></div>
      <canvas className="boot-npc npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
      <div className="boot-tip">正在加载巡演数据…</div>
    </div>
  );
}
