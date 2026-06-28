'use client';

import { useState } from 'react';
import type { Message, MessageStatus } from '@chili/shared';
import { MOODS } from '@chili/shared';

type MessagePatch = Partial<Pick<Message, 'author' | 'body' | 'cityTag' | 'mood' | 'rating' | 'status' | 'official'>>;

const STATUS_OPTIONS: MessageStatus[] = ['published', 'pending', 'hidden'];
const STATUS_LABELS: Record<MessageStatus, string> = {
  published: '已发布',
  pending: '待审核',
  hidden: '已隐藏',
};

export function MessageEditor(props: {
  initial: Message;
  onClose: () => void;
  onSave: (patch: MessagePatch) => Promise<void>;
}) {
  const { initial, onClose, onSave } = props;
  const [author, setAuthor] = useState(initial.author);
  const [body, setBody] = useState(initial.body);
  const [cityTag, setCityTag] = useState(initial.cityTag);
  const [mood, setMood] = useState(initial.mood);
  const [rating, setRating] = useState(initial.rating);
  const [status, setStatus] = useState<MessageStatus>(initial.status);
  const [official, setOfficial] = useState(initial.official);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!author.trim()) { alert('填写昵称'); return; }
    if (!body.trim()) { alert('填写留言内容'); return; }
    setSaving(true);
    try {
      await onSave({
        author: author.trim(),
        body: body.trim(),
        cityTag: cityTag.trim(),
        mood,
        rating,
        status,
        official,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal active" id="message-editor">
      <div className="sheet">
        <h3>编辑留言</h3>
        <div className="form-grid">
          <div className="field">
            <label>昵称</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="field">
            <label>城市标记</label>
            <input type="text" value={cityTag} onChange={(e) => setCityTag(e.target.value)} />
          </div>
          <div className="field">
            <label>留言内容</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="field">
            <label>心情</label>
            <div className="row">
              {MOODS.map((item) => (
                <div key={item} className={`mood-pick ${mood === item ? 'on' : ''}`} onClick={() => setMood(item)}>{item}</div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>评分</label>
            <div className="row">
              {[1, 2, 3, 4, 5].map((value) => (
                <span key={value} className={`star-pick ${rating >= value ? 'on' : ''}`} onClick={() => setRating(value)}>★</span>
              ))}
            </div>
          </div>
          <div className="field">
            <label>状态</label>
            <div className="seg">
              {STATUS_OPTIONS.map((value) => (
                <button key={value} className={status === value ? 'on' : ''} onClick={() => setStatus(value)}>{STATUS_LABELS[value]}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>官方标记</label>
            <div className="seg">
              <button className={official ? 'on' : ''} onClick={() => setOfficial(true)}>官方</button>
              <button className={!official ? 'on' : ''} onClick={() => setOfficial(false)}>普通</button>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn cancel" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn post" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}
