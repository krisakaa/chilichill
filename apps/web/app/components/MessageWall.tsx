'use client';

import { useState } from 'react';
import { drawNpc, fmtTime, renderStars } from '@chili/ui';
import { STATUS_LABEL, type Message, type Station } from '@chili/shared';
import { useApp } from '../store';
import { CityDrawer, useCityGroups, useDesktopLayout } from './CityDrawer';

export function MessageWall() {
  const {
    stations, curStation, curCityStations, curSwitchStations, messages, sortNew, toggleSort, backToMap, openCityWall,
    wallMode, openAllWall, user, setComposerOpen, setLoginOpen, setLightbox, showToast, screen, toggleReaction, openReplyComposer, clearReplyTarget,
  } = useApp();
  const [cityDrawerOpen, setCityDrawerOpen] = useState(false);
  const desktopLayout = useDesktopLayout();
  const active = screen === 'wall';
  const cityGroups = useCityGroups(stations);

  const sorted = [...messages].sort((a, b) =>
    sortNew ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );

  const findStation = (message: Message): Station | undefined => stations.find((station) => station.id === message.stationId);

  const sourceText = (message: Message) => {
    const station = findStation(message);
    if (!station) return '未知场次';
    return `${station.cityName} / ${station.venue} / ${station.date}`;
  };

  const startWrite = () => {
    if (!user) { showToast('请先登录'); setLoginOpen(true); return; }
    clearReplyTarget();
    setComposerOpen(true);
  };

  const startReply = (message: Message) => {
    if (!user) { showToast('请先登录'); setLoginOpen(true); return; }
    openReplyComposer(message);
  };

  const renderMessage = (m: Message, isReply = false) => {
    const images = m.images?.length ? m.images : (m.image ? [m.image] : []);
    return (
      <div key={m.id} className={isReply ? `reply-card ${m.official ? 'official' : ''}` : `card ${m.official ? 'official' : ''}`}>
        <div className="card-head">
          <div className={`avatar ${m.official ? 'npc-av' : 'a' + m.avatar}`}>{m.author[0]}</div>
          <div className="who">
            <b>{m.author}</b>
            <div className="meta">{m.cityTag || '日记'} / {fmtTime(m.createdAt)}</div>
          </div>
        </div>
        {wallMode === 'all' && <div className="source-tag">{sourceText(m)}</div>}
        <div className="body">{m.body}</div>
        {images.length === 1 && <img className="pic" src={images[0]} alt="" onClick={() => setLightbox(images[0])} />}
        {images.length > 1 && (
          <div className="pic-grid">
            {images.map((image) => (
              <img key={image} className="pic-thumb" src={image} alt="" onClick={() => setLightbox(image)} />
            ))}
          </div>
        )}
        <div className="mood-row">
          <span className="mood">{m.mood}</span>
          <span className="stars-rating" dangerouslySetInnerHTML={{ __html: renderStars(m.rating) }} />
          <div className="reaction-row">
            {!isReply && <button className="reaction-btn reply-action" onClick={() => startReply(m)}>追评</button>}
            <button className={`reaction-btn ${m.viewerLiked ? 'on' : ''}`} onClick={() => toggleReaction(m.id, 'like')} aria-label="点赞">👍 {m.likesCount ?? 0}</button>
            <button className={`reaction-btn heart ${m.viewerHearted ? 'on' : ''}`} onClick={() => toggleReaction(m.id, 'heart')} aria-label="比心">❤️ {m.heartsCount ?? 0}</button>
          </div>
        </div>
        {!isReply && Boolean(m.replies?.length) && (
          <div className="reply-list">
            {m.replies!.map((reply) => renderMessage(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`screen ${active ? 'active' : ''}`} id="wall-view">
      <div className="topbar">
        <button className="ico-btn back-btn" onClick={() => { setCityDrawerOpen(false); backToMap(); }}>&lt; 地图</button>
        <div className="wordmark">{wallMode === 'all' ? '全站' : curStation ? curStation.code : '选择城市'}</div>
        <div className="wall-actions">
          <button className="ico-btn city-menu-btn" onClick={() => setCityDrawerOpen(true)} disabled={cityGroups.length === 0}>城市</button>
          <button className="ico-btn all-menu-btn" onClick={() => { setCityDrawerOpen(false); openAllWall(); }}>全站</button>
          <button className="ico-btn" onClick={toggleSort}>{sortNew ? '最新' : '最早'}</button>
        </div>
      </div>

      {!desktopLayout && (
        <CityDrawer
          open={cityDrawerOpen}
          cityGroups={cityGroups}
          currentStation={curStation}
          onClose={() => setCityDrawerOpen(false)}
          onSelect={(station, group) => {
            openCityWall(station, group);
            setCityDrawerOpen(false);
          }}
        />
      )}
      <div className="stage">
        {!curStation && wallMode !== 'all' ? (
          <div className="empty">
            <canvas className="npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
            <div>在地图上选择城市<br />查看现场日记</div>
          </div>
        ) : (
          <>
            <div className="station-head">
              <div className="city">{wallMode === 'all' ? '全站' : curStation?.cityName}</div>
              <div className="date">{wallMode === 'all' ? '全部巡演留言' : curStation?.date}</div>
              <div className="venue">{wallMode === 'all' ? '全部场次 / 全部城市' : curStation?.venue}</div>
              {wallMode !== 'all' && curCityStations.length > 1 && (
                <div className="station-list">
                  {curCityStations.map((station) => (
                    <span key={station.id}>{station.date} / {station.venue}</span>
                  ))}
                </div>
              )}
              {wallMode !== 'all' && curSwitchStations.length > 1 && (
                <div className="city-switch-list">
                  {curSwitchStations.map((station) => (
                    <button
                      key={station.id}
                      className={station.id === curStation?.id ? 'on' : ''}
                      onClick={() => openCityWall(station, [station], curSwitchStations)}
                    >
                      {station.cityName}
                    </button>
                  ))}
                </div>
              )}
              <div className="count">{messages.filter((m) => !m.official).length} 篇日记</div>
              {wallMode !== 'all' && curStation && <div className={`badge-status ${curStation.status}`}>{STATUS_LABEL[curStation.status]}</div>}
            </div>
            {sorted.length === 0 ? (
              <div className="empty">
                <canvas className="npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
                <div>还没有日记<br />来写下第一篇吧</div>
              </div>
            ) : (
              sorted.map((m) => renderMessage(m))
            )}
          </>
        )}
      </div>
      <button className={`fab ${!user ? 'disabled' : ''}`} onClick={startWrite}>+ 写日记</button>
    </div>
  );
}
