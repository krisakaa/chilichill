'use client';

import { useMemo } from 'react';
import { STATUS_LABEL, type Station } from '@chili/shared';

export function cityGroupKey(station: Station) {
  return `${station.provinceAdcode ?? station.provinceName}:${station.cityName}`;
}

export function useCityGroups(stations: Station[]) {
  return useMemo(() => {
    const groups = new Map<string, Station[]>();
    for (const station of [...stations].sort((a, b) => a.date.localeCompare(b.date) || a.cityName.localeCompare(b.cityName))) {
      const key = cityGroupKey(station);
      groups.set(key, [...(groups.get(key) ?? []), station]);
    }
    return [...groups.values()];
  }, [stations]);
}

interface CityDrawerProps {
  open: boolean;
  cityGroups: Station[][];
  currentStation?: Station | null;
  onClose: () => void;
  onSelect: (station: Station, cityStations: Station[]) => void;
}

export function CityDrawer({ open, cityGroups, currentStation, onClose, onSelect }: CityDrawerProps) {
  const currentCityKey = currentStation ? cityGroupKey(currentStation) : '';

  return (
    <div className={`city-drawer-layer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button className="city-drawer-shade" type="button" aria-label="Close city menu" onClick={onClose} />
      <aside className="city-drawer" aria-label="City selection">
        <div className="city-drawer-head">
          <span>CITIES</span>
          <button className="ico-btn mini" type="button" onClick={onClose}>X</button>
        </div>
        <div className="city-drawer-list">
          {cityGroups.map((group) => {
            const station = group[0];
            const key = cityGroupKey(station);
            return (
              <button
                key={key}
                type="button"
                className={`city-drawer-item ${key === currentCityKey ? 'on' : ''}`}
                onClick={() => onSelect(station, group)}
              >
                <span className="city-drawer-city">{station.cityName}</span>
                <span className="city-drawer-meta">{group.length > 1 ? `${group.length} STOPS` : station.date}</span>
                <span className={`city-drawer-status ${station.status}`}>{STATUS_LABEL[station.status]}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
