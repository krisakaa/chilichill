'use client';

import { useState } from 'react';
import { useApp } from '../store';

export function LoginModal() {
  const { loginOpen, setLoginOpen, login } = useApp();
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');

  if (!loginOpen) return null;

  const go = async () => {
    const n = name.trim();
    if (!n) return;
    await login(n, pass);
    setName(''); setPass('');
  };

  return (
    <div className="modal active" id="login-modal">
      <div className="sheet">
        <h3>进入日记本</h3>
        <div className="field"><label>昵称</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" /></div>
        <div className="field"><label>管理员密码（粉丝可留空）</label><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••" /></div>
        <div className="auth-note">粉丝填昵称即可投稿；管理员昵称为 <b>admin</b></div>
        <div className="actions">
          <button className="btn cancel" onClick={() => setLoginOpen(false)}>取消</button>
          <button className="btn post" onClick={go}>进入</button>
        </div>
      </div>
    </div>
  );
}
