"use client";

import { useEffect, useMemo, useState } from 'react';
import { PALETTES, type Station, type StationStatus } from '@chili/shared';
import { useApp } from '../store';

const BOARD_W = 72;
const BOARD_H = 68;
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

const TEXT = {
  aria: '中国行政区划巡演图',
  title: '巡演路线图',
  done: '已去过',
  live: '正在',
  upcoming: '待出发',
  locked: '未解锁',
  heading: 'ChiliChill 巡演行政区图',
  desc: '点选高亮省市 · 查看现场日记',
  progress: '巡演进度',
  hintSuffix: '座巡演城市 · 行政区划路线',
};

type Coord = readonly [number, number];
type Ring = Coord[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type ProjectedPoint = { x: number; y: number };

interface ChinaFeature {
  type: 'Feature';
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

interface ChinaGeoJson {
  type: 'FeatureCollection';
  features: ChinaFeature[];
}

function project([lng, lat]: Coord) {
  const x = MAP_PAD_X + ((lng - CHINA_BOUNDS.minLng) / (CHINA_BOUNDS.maxLng - CHINA_BOUNDS.minLng)) * MAP_W;
  const y = MAP_PAD_Y + ((CHINA_BOUNDS.maxLat - lat) / (CHINA_BOUNDS.maxLat - CHINA_BOUNDS.minLat)) * MAP_H;
  return { x, y };
}

function percentToPoint(x: number, y: number) {
  return {
    x: MAP_PAD_X + (x / 100) * MAP_W,
    y: MAP_PAD_Y + (y / 100) * MAP_H,
  };
}

function pathFromRing(ring: Ring) {
  return ring
    .filter(([, lat]) => lat >= 17.5)
    .map((coord, index) => {
      const point = project(coord);
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(' ');
}

function pathFromFeature(feature: ChinaFeature) {
  const polygons: MultiPolygon = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Polygon]
    : feature.geometry.coordinates as MultiPolygon;

  return polygons
    .map((polygon) => polygon.map(pathFromRing).filter(Boolean).join(' Z '))
    .filter(Boolean)
    .join(' Z ')
    .concat(' Z');
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

function normalizeProvinceName(value?: string) {
  return (value ?? '')
    .trim()
    .replace(/^(内蒙古|广西|宁夏|新疆|西藏).*$/u, '$1')
    .replace(/^(香港|澳门).*$/u, '$1')
    .replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/u, '');
}

function featureMatchesStation(feature: ChinaFeature, station: Station) {
  const adcode = feature.properties.adcode;
  if (station.provinceAdcode !== undefined && adcode === station.provinceAdcode) return true;
  return normalizeProvinceName(feature.properties.name) === normalizeProvinceName(station.provinceName);
}

function stationsForProvince(feature: ChinaFeature, stations: Station[]) {
  return stations.filter((station) => featureMatchesStation(feature, station));
}

function toneForFeature(provinceStations: Station[]): StationStatus | 'plain' {
  if (provinceStations.some((station) => station.status === 'live')) return 'live';
  if (provinceStations.some((station) => station.status === 'upcoming')) return 'upcoming';
  if (provinceStations.some((station) => station.status === 'done')) return 'done';
  return 'plain';
}

function markerPosition(station: Station, provinceCenters: Record<string, ProjectedPoint>) {
  const provinceCenter = provinceCenters[station.id];
  if (provinceCenter) return provinceCenter;

  if (Number.isFinite(station.x) && Number.isFinite(station.y)) {
    return percentToPoint(station.x, station.y);
  }

  return percentToPoint(50, 50);
}

export function TourMap() {
  const { stations, openWall, openCityWall, openAdmin, user, logout, setLoginOpen, screen } = useApp();
  const [china, setChina] = useState<ChinaGeoJson | null>(null);
  const active = screen === 'map';

  useEffect(() => {
    let cancelled = false;
    fetch('/data/china-100000-full.json')
      .then((response) => response.json() as Promise<ChinaGeoJson>)
      .then((data) => {
        if (!cancelled) setChina(data);
      })
      .catch(() => {
        if (!cancelled) setChina(null);
      });
    return () => { cancelled = true; };
  }, []);

  const features = useMemo(() => (
    china?.features.filter((feature) => feature.properties.name && feature.properties.name !== '') ?? []
  ), [china]);

  const routeStations = useMemo(() => (
    [...stations].sort((a, b) => a.date.localeCompare(b.date) || a.cityName.localeCompare(b.cityName))
  ), [stations]);

  const cityGroups = useMemo(() => {
    const groups = new Map<string, Station[]>();
    for (const station of routeStations) {
      const key = `${station.provinceAdcode ?? normalizeProvinceName(station.provinceName)}:${station.cityName}`;
      groups.set(key, [...(groups.get(key) ?? []), station]);
    }
    return [...groups.values()];
  }, [routeStations]);

  const provinceCenters = useMemo(() => {
    const centers: Record<string, ProjectedPoint> = {};
    for (const station of stations) {
      const feature = features.find((item) => featureMatchesStation(item, station));
      const center = feature ? centerFromFeature(feature) : null;
      if (center) centers[station.id] = center;
    }
    return centers;
  }, [features, stations]);

  return (
    <div className={`screen ${active ? 'active' : ''}`} id="map-view">
      <div className="topbar">
        <button className="ico-btn mini" onClick={openAdmin}>?</button>
        <div className="wordmark">ChiliChill<small>TOUR DIARY</small></div>
        <button className="ico-btn on" onClick={() => (user ? logout() : setLoginOpen(true))}>
          {user ? (user.role === 'admin' ? 'ADMIN' : 'LOGOUT') : 'LOGIN'}
        </button>
      </div>

      <div className="stage">
        <div className="map-frame abstract-map" role="img" aria-label={TEXT.aria}>
          <svg className="block-map" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="xMidYMid meet">
            <title>{TEXT.aria}</title>
            <text className="block-map-title" x="35.5" y="5.2">{TEXT.title}</text>

            <g className="china-provinces">
              {features.map((feature, index) => {
                const provinceName = feature.properties.name ?? '';
                const provinceStations = stationsForProvince(feature, stations);
                const tone = toneForFeature(provinceStations);
                const firstStation = provinceStations[0];
                return (
                  <path
                    key={provinceName || feature.properties.adcode || index}
                    className={`province-shape ${tone} ${provinceStations.length ? 'has-station' : ''}`}
                    d={pathFromFeature(feature)}
                    onClick={firstStation ? () => openWall(firstStation) : undefined}
                  >
                    <title>{provinceName}</title>
                  </path>
                );
              })}
            </g>

            <polyline
              className="block-route"
              points={cityGroups.map((group) => {
                const center = markerPosition(group[0], provinceCenters);
                return `${center.x.toFixed(2)},${center.y.toFixed(2)}`;
              }).join(' ')}
            />

            {cityGroups.map((group) => {
              const station = group[0];
              const center = markerPosition(station, provinceCenters);
              const color = PALETTES[station.palette];
              return (
                <g key={`${station.provinceAdcode ?? station.provinceName}-${station.cityName}`} className="block-marker" onClick={() => openCityWall(station, group)}>
                  <circle className="marker-hit" cx={center.x} cy={center.y} r="4.2" />
                  <circle className="marker-dot" cx={center.x} cy={center.y} r={group.length > 1 ? '1.28' : '1.08'} style={{ fill: color }} />
                </g>
              );
            })}
          </svg>
          <div className="map-legend" aria-hidden="true">
            <span className="done">{TEXT.done}</span>
            <span className="live">{TEXT.live}</span>
            <span className="upcoming">{TEXT.upcoming}</span>
            <span className="plain">{TEXT.locked}</span>
          </div>
        </div>
        <div className="map-title">
          <span>TOUR BOARD</span>
          <h2>{TEXT.heading}</h2>
          <p>{TEXT.desc}</p>
        </div>
        <div className="tour-progress" aria-label={TEXT.progress}>
          {stations.map((station) => (
            <i key={station.id} className={station.status === 'done' ? 'done' : station.status === 'live' ? 'cur' : ''} />
          ))}
        </div>
        <div className="hint">{stations.length} {TEXT.hintSuffix}</div>
      </div>
    </div>
  );
}
