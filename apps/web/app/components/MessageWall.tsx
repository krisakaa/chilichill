'use client';

import { drawNpc, fmtTime, renderStars } from '@chili/ui';
import { STATUS_LABEL } from '@chili/shared';
import { useApp } from '../store';

export function MessageWall() {
  const {
    curStation, curCityStations, messages, sortNew, toggleSort, backToMap,
    user, setComposerOpen, setLoginOpen, setLightbox, showToast, screen,
  } = useApp();
  const active = screen !== 'admin';

  const sorted = [...messages].sort((a, b) =>
    sortNew ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );

  return (
    <div className="screen active" id="wall-view" style={{ display: active ? undefined : 'none' }}>
      <div className="topbar">
        <button className="ico-btn back-btn" onClick={backToMap}>&lt; MAP</button>
        <div className="wordmark">{curStation ? curStation.code : 'SELECT'}</div>
        <button className="ico-btn" onClick={toggleSort}>{sortNew ? '新' : '旧'}</button>
      </div>
      <div className="stage">
        {!curStation ? (
          <div className="empty">
            <canvas className="npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
            <div>← 在左侧地图点选一座城市<br />查看该站粉丝日记</div>
          </div>
        ) : (
          <>
            <div className="station-head">
              <div className="city">{curStation.cityName}</div>
              <div className="date">{curStation.date}</div>
              <div className="venue">{curStation.venue}</div>
              {curCityStations.length > 1 && (
                <div className="station-list">
                  {curCityStations.map((station) => (
                    <span key={station.id}>{station.date} · {station.venue}</span>
                  ))}
                </div>
              )}
              <div className="count">共 {messages.filter((m) => !m.official).length} 条粉丝日记</div>
              <div className={`badge-status ${curStation.status}`}>{STATUS_LABEL[curStation.status]}</div>
            </div>
            {sorted.length === 0 ? (
              <div className="empty">
                <canvas className="npc" ref={(c) => { if (c) drawNpc(c); }} width={46} height={46} />
                <div>这里还没有日记<br />成为第一个写下回忆的人吧</div>
              </div>
            ) : (
              sorted.map((m) => {
                const images = m.images?.length ? m.images : (m.image ? [m.image] : []);
                return (
                  <div key={m.id} className={`card ${m.official ? 'official' : ''}`}>
                    <div className="card-head">
                      <div className={`avatar ${m.official ? 'npc-av' : 'a' + m.avatar}`}>{m.author[0]}</div>
                      <div className="who">
                        <b>{m.author}</b>
                        <div className="meta">{m.cityTag} · {fmtTime(m.createdAt)}</div>
                      </div>
                    </div>
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
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
      <button
        className={`fab ${!user ? 'disabled' : ''}`}
        onClick={() => {
          if (!user) { showToast('请先登录'); setLoginOpen(true); return; }
          setComposerOpen(true);
        }}
      >+ WRITE</button>
    </div>
  );
}