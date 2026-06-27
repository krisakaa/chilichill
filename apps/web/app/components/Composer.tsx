'use client';

import { useMemo, useRef, useState } from 'react';
import { MOODS } from '@chili/shared';
import { useApp } from '../store';

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type PickedImage = {
  id: string;
  file: File;
  preview: string;
};

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
};

function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

function humanSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(size > 1024 * 1024 ? 1 : 2)}MB`;
}

async function uploadImage(file: File): Promise<string> {
  const response = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '图片上传配置不可用' })) as { error?: string };
    throw new Error(error.error ?? '图片上传配置不可用');
  }
  const signed = await response.json() as PresignResponse;
  const upload = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!upload.ok) throw new Error('图片上传失败，请检查 R2 CORS 配置');
  return signed.publicUrl;
}

export function Composer() {
  const { composerOpen, setComposerOpen, stations, user, submitMessage, showToast } = useApp();
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [city, setCity] = useState<string | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canAddImages = images.length < MAX_IMAGES;
  const imageCountText = useMemo(() => `${images.length}/${MAX_IMAGES}`, [images.length]);

  if (!composerOpen) return null;

  const clearImages = () => {
    for (const image of images) URL.revokeObjectURL(image.preview);
    setImages([]);
  };

  const reset = () => {
    setBody(''); setMood(null); setRating(0); setCity(null); clearImages(); setUploading(false);
    setComposerOpen(false);
  };

  const chooseFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: PickedImage[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= MAX_IMAGES) {
        showToast(`最多上传 ${MAX_IMAGES} 张`);
        break;
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        showToast('仅支持 JPG / PNG / WebP / GIF');
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        showToast(`单张图片不能超过 ${humanSize(MAX_IMAGE_SIZE)}`);
        continue;
      }
      next.push({ id: fileId(file), file, preview: URL.createObjectURL(file) });
    }
    if (next.length) setImages((current) => [...current, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((image) => image.id !== id);
    });
  };

  const submit = async () => {
    if (uploading) return;
    if (!body.trim()) { showToast('写点什么吧'); return; }
    if (!mood) { showToast('选个心情'); return; }
    try {
      setUploading(true);
      const uploadedImages = images.length ? await Promise.all(images.map((image) => uploadImage(image.file))) : [];
      await submitMessage({
        body: body.trim(),
        mood,
        rating: rating || 3,
        cityTag: city ?? '',
        images: uploadedImages,
      });
      setBody(''); setMood(null); setRating(0); clearImages();
      showToast('已提交，等待审核');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
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
          <label>现场图片（可选 · {imageCountText}）</label>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => chooseFiles(e.target.files)}
          />
          <div className="image-picker">
            {images.map((image) => (
              <button key={image.id} type="button" className="img-slot has" style={{ backgroundImage: `url(${image.preview})` }} onClick={() => removeImage(image.id)} aria-label="移除图片">
                <span>×</span>
              </button>
            ))}
            {canAddImages && (
              <button type="button" className="img-slot" onClick={() => fileInputRef.current?.click()} disabled={uploading}>+</button>
            )}
          </div>
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
          <button className="btn cancel" onClick={reset} disabled={uploading}>取消</button>
          <button className="btn post" onClick={submit} disabled={uploading}>{uploading ? '上传中...' : '发布'}</button>
        </div>
      </div>
    </div>
  );
}