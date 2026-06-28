'use client';

import { useEffect, useState } from 'react';

type Diagnostics = {
  checkedAt: string;
  supabase: {
    configured: boolean;
    ok: boolean;
    stationsCount: number | null;
    messagesCount: number | null;
    messageImagesCount: number | null;
    error: string;
  };
  r2: {
    configured: boolean;
    missing: string[];
    publicBaseUrl: string;
  };
};

function statusText(ok: boolean, configured = true) {
  if (!configured) return '未配置';
  return ok ? '正常' : '异常';
}

export function AdminDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/diagnostics');
      if (!response.ok) throw new Error(await response.text());
      setDiagnostics(await response.json() as Diagnostics);
    } catch (err) {
      setDiagnostics(null);
      setError(err instanceof Error ? err.message : '诊断读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="admin-diagnostics">
      <div className="ai-top">
        <div>
          <div className="ai-title">系统诊断</div>
          <div className="ai-sub">Supabase / R2 / 图片链路配置速查</div>
        </div>
        <button className="mini-btn edit" onClick={() => void load()} disabled={loading}>{loading ? '检测中' : '刷新'}</button>
      </div>

      {error && <div className="diag-error">{error}</div>}

      {diagnostics && (
        <div className="diag-grid">
          <div className="diag-row">
            <b>Supabase</b>
            <span className={diagnostics.supabase.ok ? 'ok' : 'bad'}>{statusText(diagnostics.supabase.ok, diagnostics.supabase.configured)}</span>
          </div>
          <div className="diag-row muted">
            <b>数据量</b>
            <span>{diagnostics.supabase.stationsCount ?? '-'} 站 / {diagnostics.supabase.messagesCount ?? '-'} 留言 / {diagnostics.supabase.messageImagesCount ?? '-'} 图</span>
          </div>
          {diagnostics.supabase.error && <div className="diag-note">{diagnostics.supabase.error}</div>}

          <div className="diag-row">
            <b>R2 上传配置</b>
            <span className={diagnostics.r2.configured ? 'ok' : 'bad'}>{diagnostics.r2.configured ? '完整' : '缺失'}</span>
          </div>
          <div className="diag-row muted">
            <b>图片公开域</b>
            <span>{diagnostics.r2.publicBaseUrl || '-'}</span>
          </div>
          {diagnostics.r2.missing.length > 0 && <div className="diag-note">缺少：{diagnostics.r2.missing.join(', ')}</div>}
          <div className="diag-time">{new Date(diagnostics.checkedAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
