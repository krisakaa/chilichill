'use client';

import { useState } from 'react';
import { MOODS } from '@chili/shared';
import { useApp } from '../store';

export function Composer() {
  const { composerOpen, setComposerOpen, stations, user, submitMessage, showToast } = useApp();
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [city, setCity] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);

  if (!composerOpen) return null;

  const reset = () => {
    setBody(''); setMood(null); setRating(0); setCity(null); setImg(null);
    setComposerOpen(false);
  };

  const submit = async () => {
    if (!body.trim()) { showToast('写点什么吧'); return; }
    if (!mood) { showToast('选个心情'); return; }
    await submitMessage({
      body: body.trim(),
      mood,
      rating: rating || 3,
      cityTag: city ?? '',
      image: img ?? '',
    });
    setBody(''); setMood(null); setRating(0); setImg(null);
  };

  return (
    <div className="modal active" id="composer">
      <div className="sheet">
        <h3>写下你的日记</h3>
        <div className="field">
          <label>留言</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="今天的现场太燃了..." />
        </div>
        <div className="field">
          <label>心情（小人表情）</label>
          <div className="row">
            {MOODS.map((m) => (
              <div key={m} className={`mood-pick ${mood === m ? 'on' : ''}`} onClick={() => setMood(m)}>{m}</div>
            ))}
          </div>
        </div>
        <div className="field">
          <label>评分</label>
          <div className="row">
            {[1, 2, 3, 4, 5].map((v) => (
              <span key={v} className={`star-pick ${rating >= v ? 'on' : ''}`} onClick={() => setRating(v)}>★</span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>演示图片（可选 · 暂未接入真实上传）</label>
          <div
            className={`img-slot ${img ? 'has' : ''}`}
            style={img ? { backgroundImage: `url(${img})` } : undefined}
            onClick={() => {
              const seed = Math.floor(Math.random() * 9999);
              setImg(`https://picsum.photos/seed/u${seed}/320/180`);
              showToast('已添加演示图片');
            }}
          >{img ? '' : '+'}</div>
        </div>
        <div className="field">
          <label>城市标记</label>
          <div className="row">
            {stations.map((s) => (
              <div key={s.id} className={`city-pick ${city === s.name ? 'on' : ''}`} onClick={() => setCity(s.name)}>{s.name}</div>
            ))}
          </div>
        </div>
        <div className="auth-note">{user ? `以 ${user.username} 身份发布` : '请先登录'}</div>
        <div className="actions">
          <button className="btn cancel" onClick={reset}>取消</button>
          <button className="btn post" onClick={submit}>发布</button>
        </div>
      </div>
    </div>
  );
}
