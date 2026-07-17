'use client';

import { memo, useMemo, useState } from 'react';
import { drawNpc, fmtTime, renderStars } from '@chili/ui';
import { STATUS_LABEL, type Message, type ReactionType, type Station } from '@chili/shared';
import { useApp, type WallMode } from '../store';
import { CityDrawer, useCityGroups, useDesktopLayout } from './CityDrawer';

interface MessageCardProps {
  message: Message;
  isReply?: boolean;
  wallMode: WallMode;
  stationById: Map<string, Station>;
  onLightbox: (url: string) => void;
  onReply: (message: Message) => void;
  onReaction: (messageId: string, type: ReactionType) => void;
  onShare?: (message: Message) => void;
}

const MessageCard = memo(function MessageCard({ message, isReply = false, wallMode, stationById, onLightbox, onReply, onReaction, onShare }: MessageCardProps) {
  const images = message.images?.length ? message.images : (message.image ? [message.image] : []);
  const thumbs = message.imageThumbs ?? [];
  const station = message.stationId ? stationById.get(message.stationId) : undefined;
  const sourceText = station ? `${station.cityName} / ${station.venue} / ${station.date}` : '未知场次';

  const renderImage = (image: string, index: number, className: string) => (
    <img
      key={`${image}-${index}`}
      className={className}
      src={thumbs[index] || image}
      alt=""
      loading="lazy"
      decoding="async"
      onClick={() => onLightbox(image)}
    />
  );

  return (
    <div className={isReply ? `reply-card ${message.official ? 'official' : ''}` : `card ${message.official ? 'official' : ''}`}>
      <div className="card-head">
        <div className={`avatar ${message.official ? 'npc-av' : 'a' + message.avatar}`}>{message.author[0]}</div>
        <div className="who">
          <b>{message.author}</b>
          <div className="meta">{message.cityTag || '日记'} / {fmtTime(message.createdAt)}</div>
        </div>
      </div>
      {wallMode === 'all' && <div className="source-tag">{sourceText}</div>}
      <div className="body">{message.body}</div>
      {images.length === 1 && renderImage(images[0], 0, 'pic')}
      {images.length > 1 && <div className="pic-grid">{images.map((image, index) => renderImage(image, index, 'pic-thumb'))}</div>}
      <div className="mood-row">
        <span className="mood">{message.mood}</span>
        <span className="stars-rating" dangerouslySetInnerHTML={{ __html: renderStars(message.rating) }} />
        <div className="reaction-row">
          {!isReply && <button className="reaction-btn reply-action" onClick={() => onReply(message)}>💬 {message.replies?.length ?? 0}</button>}
          <button className={`reaction-btn ${message.viewerLiked ? 'on' : ''}`} onClick={() => onReaction(message.id, 'like')} aria-label="点赞">👍 {message.likesCount ?? 0}</button>
          <button className={`reaction-btn heart ${message.viewerHearted ? 'on' : ''}`} onClick={() => onReaction(message.id, 'heart')} aria-label="比心">❤️ {message.heartsCount ?? 0}</button>
          <button className="reaction-btn share-btn" onClick={() => onShare?.(message)} aria-label="分享">📤</button>
        </div>
      </div>
      {!isReply && Boolean(message.replies?.length) && (
        <div className="reply-list">
          {message.replies!.map((reply) => (
            <MessageCard
              key={reply.id}
              message={reply}
              isReply
              wallMode={wallMode}
              stationById={stationById}
              onLightbox={onLightbox}
              onReply={onReply}
              onReaction={onReaction}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function MessageWall() {
  const {
    stations, curStation, curCityStations, curSwitchStations, messages, sortNew, toggleSort, backToMap, openCityWall,
    wallMode, openAllWall, user, setComposerOpen, setLoginOpen, setLightbox, setShareOpen, openShareCard, showToast, screen, toggleReaction, openReplyComposer, clearReplyTarget,
    loadMoreMessages, messagesHasMore, messagesLoading, messagesLoadingMore,
  } = useApp();
  const [cityDrawerOpen, setCityDrawerOpen] = useState(false);
  const desktopLayout = useDesktopLayout();
  const active = screen === 'wall';
  const cityGroups = useCityGroups(stations);
  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station])), [stations]);
  const sorted = useMemo(() => [...messages].sort((a, b) => (sortNew ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)), [messages, sortNew]);

  const startWrite = () => {
    if (!user) { showToast('请先登录'); setLoginOpen(true); return; }
    clearReplyTarget();
    setComposerOpen(true);
  };

  const startReply = (message: Message) => {
    if (!user) { showToast('请先登录'); setLoginOpen(true); return; }
    openReplyComposer(message);
  };

  return (
    <div className={`screen ${active ? 'active' : ''}`} id="wall-view">
      <div className="topbar">
        <button className="ico-btn back-btn" onClick={() => { setCityDrawerOpen(false); backToMap(); }}>&lt; 地图</button>
        <div className="wordmark">{wallMode === 'all' ? '全站' : curStation ? curStation.code : '选择城市'}</div>
        <div className="wall-actions">
          <button className="ico-btn city-menu-btn" onClick={() => setCityDrawerOpen(true)} disabled={cityGroups.length === 0}>城市</button>
          <button className="ico-btn" onClick={() => setShareOpen(true)}>分享</button>
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
                  {curCityStations.map((station) => <span key={station.id}>{station.date} / {station.venue}</span>)}
                </div>
              )}
              {wallMode !== 'all' && curSwitchStations.length > 1 && (
                <div className="city-switch-list">
                  {curSwitchStations.map((station) => (
                    <button key={station.id} className={station.id === curStation?.id ? 'on' : ''} onClick={() => openCityWall(station, [station], curSwitchStations)}>
                      {station.cityName}
                    </button>
                  ))}
                </div>
              )}
              <div className="count">{messages.filter((m) => !m.official).length} 篇日记</div>
              {wallMode !== 'all' && curStation && <div className={`badge-status ${curStation.status}`}>{STATUS_LABEL[curStation.status]}</div>}
            </div>
            {messagesLoading && sorted.length === 0 ? (
              <div className="empty">LOADING...</div>
            ) : sorted.length === 0 ? (
              <div className="empty">
                <canvas className="npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
                <div>还没有日记<br />来写下第一篇吧</div>
              </div>
            ) : (
              <>
                {sorted.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    wallMode={wallMode}
                    stationById={stationById}
                    onLightbox={setLightbox}
                    onReply={startReply}
                    onReaction={toggleReaction}
                  />
                ))}
                {messagesHasMore && (
                  <div className="load-more-row">
                    <button className="load-more-btn" onClick={loadMoreMessages} disabled={messagesLoadingMore}>
                      {messagesLoadingMore ? 'LOADING...' : 'LOAD MORE'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <button className={`fab ${!user ? 'disabled' : ''}`} onClick={startWrite}>+ 写日记</button>
    </div>
  );
}
