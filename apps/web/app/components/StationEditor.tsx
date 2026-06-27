'use client';

import { useEffect, useState } from 'react';
import type { Station } from '@chili/shared';
import { PALETTES, STATUS_LABEL } from '@chili/shared';

type PaletteKey = keyof typeof PALETTES;

interface ProvinceOption {
  name: string;
  adcode?: number;
}

const CITY_COORDS: Record<string, { x: number; y: number }> = {
  上海: { x: 78.6, y: 53.8 },
  北京: { x: 62.7, y: 30.8 },
  广州: { x: 57.9, y: 79.7 },
  成都: { x: 38.9, y: 59.4 },
  武汉: { x: 60.4, y: 61.6 },
};

export function StationEditor(props: {
  initial: Station | null;
  onClose: () => void;
  onSave: (data: Partial<Station> & { name: string }) => void;
}) {
  const { initial, onClose, onSave } = props;
  const [name, setName] = useState(initial?.name ?? '');
  const [cityName, setCityName] = useState(initial?.cityName ?? initial?.name ?? '');
  const [provinceName, setProvinceName] = useState(initial?.provinceName ?? '');
  const [provinceAdcode, setProvinceAdcode] = useState<number | undefined>(initial?.provinceAdcode);
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [x, setX] = useState(String(initial?.x ?? 50));
  const [y, setY] = useState(String(initial?.y ?? 50));
  const [code, setCode] = useState(initial?.code ?? '');
  const [palette, setPalette] = useState<PaletteKey>(initial?.palette ?? 'hot');
  const [status, setStatus] = useState<Station['status']>(initial?.status ?? 'upcoming');
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/china-100000-full.json')
      .then((response) => response.json() as Promise<{ features: Array<{ properties: ProvinceOption }> }>)
      .then((data) => {
        if (!cancelled) setProvinces(data.features.map((feature) => feature.properties).filter((item) => item.name));
      })
      .catch(() => {
        if (!cancelled) setProvinces([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const coord = CITY_COORDS[cityName.trim()];
    if (!initial && coord) {
      setX(String(coord.x));
      setY(String(coord.y));
    }
  }, [cityName, initial]);

  return (
    <div className="modal active" id="station-editor">
      <div className="sheet">
        <h3>{initial ? '编辑站点' : '新增站点'}</h3>
        <div className="form-grid">
          <div className="field"><label>城市名</label><input type="text" value={cityName} onChange={(e) => { setCityName(e.target.value); if (!name || name === cityName) setName(e.target.value); }} /></div>
          <div className="field"><label>行政区</label>
            <select value={provinceName} onChange={(e) => {
              const next = provinces.find((province) => province.name === e.target.value);
              setProvinceName(next?.name ?? '');
              setProvinceAdcode(next?.adcode);
            }}>
              <option value="">选择省/市</option>
              {provinces.map((province) => <option key={province.adcode ?? province.name} value={province.name}>{province.name}</option>)}
            </select>
          </div>
          <div className="field"><label>场次显示名</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="默认同城市名" /></div>
          <div className="field"><label>演出场馆</label><input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
          <div className="field"><label>演出日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>地图坐标（百分比 0-100）</label>
            <div className="coord-row">
              <input type="text" value={x} onChange={(e) => setX(e.target.value)} placeholder="X" />
              <input type="text" value={y} onChange={(e) => setY(e.target.value)} placeholder="Y" />
            </div>
          </div>
          <div className="field"><label>主题色</label>
            <div className="palette-row">
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
                <div key={k} className={`sw ${palette === k ? 'on' : ''}`} style={{ background: PALETTES[k] }} onClick={() => setPalette(k)} />
              ))}
            </div>
          </div>
          <div className="field"><label>状态</label>
            <div className="seg">
              {(['upcoming', 'live', 'done'] as const).map((v) => (
                <button key={v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{STATUS_LABEL[v]}</button>
              ))}
            </div>
          </div>
          <div className="field"><label>缩写（地图标记）</label><input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={3} /></div>
        </div>
        <div className="actions">
          <button className="btn cancel" onClick={onClose}>取消</button>
          <button className="btn post" onClick={() => {
            if (!cityName.trim()) { alert('填城市名'); return; }
            if (!provinceName) { alert('选择行政区'); return; }
            onSave({
              id: initial?.id,
              name: name.trim() || cityName.trim(),
              cityName: cityName.trim(),
              provinceName,
              provinceAdcode,
              venue: venue.trim() || '待定',
              date: date || '待定',
              x: Math.max(5, Math.min(95, +x || 50)),
              y: Math.max(8, Math.min(85, +y || 50)),
              code: code.trim() || name.slice(0, 2),
              status,
              palette,
            });
          }}>保存</button>
        </div>
      </div>
    </div>
  );
}
