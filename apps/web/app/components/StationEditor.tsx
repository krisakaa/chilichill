'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Station } from '@chili/shared';
import { PALETTES, STATUS_LABEL } from '@chili/shared';

type PaletteKey = keyof typeof PALETTES;
type Coord = readonly [number, number];
type Ring = Coord[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const MAP_PAD_X = 4.6;
const MAP_PAD_Y = 8.5;
const MAP_W = 62.8;
const MAP_H = 45.6;

const CHINA_BOUNDS = {
  minLng: 73.5,
  maxLng: 135.1,
  minLat: 18,
  maxLat: 53.6,
};

interface ProvinceOption {
  name: string;
  adcode?: number;
  center?: Coord;
  centroid?: Coord;
  x: number;
  y: number;
}

interface ChinaFeature {
  properties: {
    name?: string;
    adcode?: number;
    center?: Coord;
    centroid?: Coord;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: Polygon | MultiPolygon;
  };
}

function project([lng, lat]: Coord) {
  const x = MAP_PAD_X + ((lng - CHINA_BOUNDS.minLng) / (CHINA_BOUNDS.maxLng - CHINA_BOUNDS.minLng)) * MAP_W;
  const y = MAP_PAD_Y + ((CHINA_BOUNDS.maxLat - lat) / (CHINA_BOUNDS.maxLat - CHINA_BOUNDS.minLat)) * MAP_H;
  return { x, y };
}

function toPercent(point: { x: number; y: number }) {
  return {
    x: Number((((point.x - MAP_PAD_X) / MAP_W) * 100).toFixed(1)),
    y: Number((((point.y - MAP_PAD_Y) / MAP_H) * 100).toFixed(1)),
  };
}

function centerFromFeature(feature: ChinaFeature) {
  const rawCenter = feature.properties.center ?? feature.properties.centroid;
  if (rawCenter) return project(rawCenter);

  const polygons: MultiPolygon = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Polygon]
    : feature.geometry.coordinates as MultiPolygon;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const coord of ring) {
        if (coord[1] < 17.5) continue;
        const point = project(coord);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function provinceFromFeature(feature: ChinaFeature): ProvinceOption | null {
  if (!feature.properties.name) return null;
  const center = centerFromFeature(feature);
  if (!center) return null;
  const percent = toPercent(center);

  return {
    name: feature.properties.name,
    adcode: feature.properties.adcode,
    center: feature.properties.center,
    centroid: feature.properties.centroid,
    x: Math.max(5, Math.min(95, percent.x)),
    y: Math.max(8, Math.min(85, percent.y)),
  };
}

function formatCoord(value: number) {
  return value.toFixed(1).replace(/\.0$/u, '');
}

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
  const [x, setX] = useState(initial?.x ?? 50);
  const [y, setY] = useState(initial?.y ?? 50);
  const [code, setCode] = useState(initial?.code ?? '');
  const [palette, setPalette] = useState<PaletteKey>(initial?.palette ?? 'hot');
  const [status, setStatus] = useState<Station['status']>(initial?.status ?? 'upcoming');
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);

  const selectedProvince = useMemo(() => (
    provinces.find((province) => province.name === provinceName)
  ), [provinceName, provinces]);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/china-100000-full.json')
      .then((response) => response.json() as Promise<{ features: ChinaFeature[] }>)
      .then((data) => {
        if (cancelled) return;
        setProvinces(data.features
          .map(provinceFromFeature)
          .filter((item): item is ProvinceOption => Boolean(item)));
      })
      .catch(() => {
        if (!cancelled) setProvinces([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const next = provinces.find((province) => province.name === provinceName)
      ?? provinces.find((province) => province.adcode !== undefined && province.adcode === provinceAdcode);
    if (!next) return;
    setProvinceName(next.name);
    setProvinceAdcode(next.adcode);
    setX(next.x);
    setY(next.y);
  }, [provinceAdcode, provinceName, provinces]);

  const coordText = selectedProvince
    ? `${selectedProvince.name}中心 ${formatCoord(x)} / ${formatCoord(y)}`
    : `待选择行政区 ${formatCoord(x)} / ${formatCoord(y)}`;

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
              if (next) {
                setX(next.x);
                setY(next.y);
              }
            }}>
              <option value="">选择省/市</option>
              {provinces.map((province) => <option key={province.adcode ?? province.name} value={province.name}>{province.name}</option>)}
            </select>
          </div>
          <div className="field"><label>场次显示名</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="默认同城市名" /></div>
          <div className="field"><label>演出场馆</label><input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
          <div className="field"><label>演出日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>地图坐标</label>
            <div className="coord-readonly" aria-live="polite">
              <span>自动绑定</span>
              <b>{coordText}</b>
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
            if (!selectedProvince) { alert('选择行政区'); return; }
            const displayName = name.trim() || cityName.trim();
            onSave({
              id: initial?.id,
              name: displayName,
              cityName: cityName.trim(),
              provinceName: selectedProvince.name,
              provinceAdcode: selectedProvince.adcode,
              venue: venue.trim() || '待定',
              date: date || '待定',
              x: selectedProvince.x,
              y: selectedProvince.y,
              code: code.trim() || displayName.slice(0, 2),
              status,
              palette,
            });
          }}>保存</button>
        </div>
      </div>
    </div>
  );
}
