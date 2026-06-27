'use client';

import { useApp } from '../store';

export function Lightbox() {
  const { lightbox, setLightbox } = useApp();
  if (!lightbox) return null;
  return (
    <div className="active" id="lightbox" onClick={(e) => { if ((e.target as HTMLElement).id === 'lightbox') setLightbox(null); }}>
      <button className="close" onClick={() => setLightbox(null)}>✕</button>
      <img src={lightbox} alt="" />
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  return <div id="toast" className={toast ? 'show' : ''}><span>{toast}</span></div>;
}
