'use client';

import { useState } from 'react';
import type { Message, Station } from '@chili/shared';
import { STATUS_LABEL } from '@chili/shared';
import {
  deleteStation, setMessageStatus, setMessageOfficial, deleteMessage, resetData, updateMessage, upsertStation,
} from '@chili/db';
import { fmtTime } from '@chili/ui';
import { useApp } from '../store';
import { StationEditor } from './StationEditor';
import { MessageEditor } from './MessageEditor';
import { AdminDiagnostics } from './AdminDiagnostics';

type AdminTab = 'overview' | 'stations' | 'messages';

export function AdminConsole() {
  const { stations, allMsgs, refreshStations, refreshAdmin, showToast, setScreen, setLightbox } = useApp();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [msgSearch, setMsgSearch] = useState('');
  const [editStation, setEditStation] = useState<Station | null | 'new'>(null);
  const [editMessage, setEditMessage] = useState<Message | null>(null);

  const hiddenCount = allMsgs.filter((m) => m.status === 'hidden').length;
  const officialCount = allMsgs.filter((m) => m.official).length;

  return (
    <div className="screen active" id="admin-view">
      <div className="topbar">
        <button className="ico-btn" onClick={() => setScreen('map')}>&lt; EXIT</button>
        <div className="wordmark">ADMIN<small>控制台</small></div>
        <button className="ico-btn mini" onClick={async () => {
          await resetData();
          await refreshStations();
          await refreshAdmin();
          showToast('已重置为种子数据');
        }}>RESET</button>
      </div>
      <div className="admin-nav">
        {(['overview', 'stations', 'messages'] as AdminTab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'overview' ? '概览' : t === 'stations' ? '站点' : '留言'}
          </button>
        ))}
      </div>
      <div className="stage"><div className="admin-body">
        {tab === 'overview' && (
          <>
            <div className="admin-h">概览</div>
            <div className="stat-grid">
              <div className="stat"><b>{stations.length}</b><span>巡演站点</span></div>
              <div className="stat"><b>{allMsgs.length}</b><span>留言总数</span></div>
              <div className="stat"><b>{officialCount}</b><span>官方留言</span></div>
              <div className="stat"><b>{hiddenCount}</b><span>已隐藏</span></div>
            </div>
            <AdminDiagnostics />
            <div className="admin-h">站点速览</div>
            {stations.map((s) => (
              <div key={s.id} className="admin-item">
                <div className="ai-top">
                  <div>
                    <div className="ai-title">{s.name}</div>
                    <div className="ai-sub">{s.venue} · {s.date} · {allMsgs.filter((m) => m.stationId === s.id && m.status === 'published').length} 条</div>
                  </div>
                  <span className={`admin-tag ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'stations' && (
          <>
            <div className="admin-h">站点管理</div>
            {stations.map((s) => (
              <div key={s.id} className="admin-item">
                <div className="ai-top">
                  <div>
                    <div className="ai-title">{s.name} <span style={{ color: 'var(--dim)', fontSize: 11 }}>({s.code})</span></div>
                    <div className="ai-sub">{s.venue} · {s.date} · 坐标 {s.x},{s.y}</div>
                  </div>
                  <span className={`admin-tag ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                </div>
                <div className="ai-actions">
                  <button className="mini-btn edit" onClick={() => setEditStation(s)}>编辑</button>
                  <button className="mini-btn del" onClick={async () => {
                    if (confirm('删除该站点？其下留言会保留但脱离站点。')) {
                      await deleteStation(s.id); await refreshStations(); await refreshAdmin(); showToast('已删除');
                    }
                  }}>删除</button>
                </div>
              </div>
            ))}
            <div className="add-bar"><button className="btn post" onClick={() => setEditStation('new')}>+ 新增站点</button></div>
          </>
        )}

        {tab === 'messages' && (
          <>
            <div className="admin-h">留言管理</div>
            <div className="search-row">
              <input type="text" value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)} placeholder="搜索昵称 / 内容 / 城市" />
            </div>
            {allMsgs
              .filter((m) => {
                const q = msgSearch.trim().toLowerCase();
                if (!q) return true;
                return m.author.toLowerCase().includes(q) || m.body.toLowerCase().includes(q) || m.cityTag.toLowerCase().includes(q);
              })
              .map((m) => {
                const s = stations.find((x) => x.id === m.stationId);
                const images = m.images?.length ? m.images : (m.image ? [m.image] : []);
                return (
                  <div key={m.id} className="admin-item">
                    <div className="ai-top">
                      <div>
                        <div className="ai-title">{m.author}
                          {m.official && <span className="admin-tag official">官方</span>}
                          {m.status === 'pending' && <span className="admin-tag pending">待审核</span>}
                          {m.status === 'hidden' && <span className="admin-tag hidden">已隐藏</span>}
                        </div>
                        <div className="ai-sub">[{s?.name ?? '未归属'}] {m.cityTag} · {fmtTime(m.createdAt)} · {m.mood} {'★'.repeat(m.rating)}</div>
                      </div>
                    </div>
                    <div className="body" style={{ fontSize: 13, margin: '6px 0' }}>{m.body}</div>
                    {images.length > 0 && (
                      <div className="admin-pic-grid">
                        {images.map((image) => (
                          <img key={image} src={image} alt="" onClick={() => setLightbox(image)} />
                        ))}
                      </div>
                    )}
                    <div className="ai-actions">
                      <button className="mini-btn edit" onClick={() => setEditMessage(m)}>编辑</button>
                      {m.status === 'pending' && (
                        <button className="mini-btn edit" onClick={async () => { await setMessageStatus(m.id, 'published'); await refreshAdmin(); showToast('已通过'); }}>
                          通过
                        </button>
                      )}
                      <button className="mini-btn pin" onClick={async () => { await setMessageOfficial(m.id, !m.official); await refreshAdmin(); }}>
                        {m.official ? '取消官方' : '置官方'}
                      </button>
                      <button className="mini-btn hide" onClick={async () => { await setMessageStatus(m.id, m.status === 'hidden' ? 'published' : 'hidden'); await refreshAdmin(); }}>
                        {m.status === 'hidden' ? '恢复' : '隐藏'}
                      </button>
                      <button className="mini-btn del" onClick={async () => {
                        if (confirm('删除该留言？')) { await deleteMessage(m.id); await refreshAdmin(); showToast('已删除'); }
                      }}>删除</button>
                    </div>
                  </div>
                );
              })}
          </>
        )}

      </div></div>

      {editMessage && (
        <MessageEditor
          initial={editMessage}
          onClose={() => setEditMessage(null)}
          onSave={async (patch) => {
            await updateMessage(editMessage.id, patch);
            await refreshAdmin();
            setEditMessage(null);
            showToast('留言已保存');
          }}
        />
      )}

      {editStation && (
        <StationEditor
          initial={editStation === 'new' ? null : editStation}
          onClose={() => setEditStation(null)}
          onSave={async (data) => {
            await upsertStation(data);
            await refreshStations();
            setEditStation(null);
            showToast('站点已保存');
          }}
        />
      )}
    </div>
  );
}
