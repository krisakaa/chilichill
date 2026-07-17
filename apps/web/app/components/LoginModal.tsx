'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';

export function LoginModal() {
  const { loginOpen, setLoginOpen, login } = useApp();
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loginOpen) {
      setClosing(false);
      setName('');
      setPass('');
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loginOpen]);

  if (!loginOpen && !closing) return null;

  const handleClose = () => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setClosing(false);
      setLoginOpen(false);
    }, 250);
  };

  const go = async () => {
    const n = name.trim();
    if (!n) return;
    await login(n, pass);
    setName(''); setPass('');
    handleClose();
  };

  return (
    <div className={`modal ${closing ? 'closing' : 'active'}`} id="login-modal" onClick={handleClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="sheet-avatar">🔐</div>
          <h3>进入日记本</h3>
          <button className="sheet-close" onClick={handleClose} aria-label="关闭">✕</button>
        </div>
        <div className="field">
          <label><span className="field-icon">👤</span>昵称</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" autoFocus />
        </div>
        <div className="field">
          <label><span className="field-icon">🔑</span>管理员密码（游客可留空）</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••" />
        </div>
        <div className="auth-note">游客填写昵称即可投稿；管理员昵称为 <b>admin</b></div>
        <div className="actions">
          <button className="btn cancel" onClick={handleClose}>取消</button>
          <button className="btn post" onClick={go}>进入</button>
        </div>
      </div>
    </div>
  );
}
