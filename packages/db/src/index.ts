import type { MessageStatus, Station } from '@chili/shared';
import * as mock from './mock';

declare const process: { env: { NEXT_PUBLIC_SUPABASE_URL?: string } };

function canUseApi() {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!canUseApi()) return null;
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (response.status === 503) return null;
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function listStations() {
  return (await api<Awaited<ReturnType<typeof mock.listStations>>>('/api/stations')) ?? mock.listStations();
}

export async function getStation(id: string) {
  const stations = await listStations();
  return stations.find((station) => station.id === id) ?? null;
}

export async function listMessages(stationId: string, opts?: { includeHidden?: boolean }) {
  if (opts?.includeHidden) return mock.listMessages(stationId, opts);
  return (await api<Awaited<ReturnType<typeof mock.listMessages>>>(`/api/messages?stationId=${encodeURIComponent(stationId)}`)) ?? mock.listMessages(stationId, opts);
}

export async function listMessagesForStations(stationIds: string[], opts?: { includeHidden?: boolean }) {
  if (opts?.includeHidden) return mock.listMessagesForStations(stationIds, opts);
  const query = stationIds.map(encodeURIComponent).join(',');
  return (await api<Awaited<ReturnType<typeof mock.listMessagesForStations>>>(`/api/messages?stationIds=${query}`)) ?? mock.listMessagesForStations(stationIds, opts);
}

export async function listAllMessages() {
  return (await api<Awaited<ReturnType<typeof mock.listAllMessages>>>('/api/admin/messages')) ?? mock.listAllMessages();
}

export async function listUsers() {
  return mock.listUsers();
}

export async function createMessage(input: Parameters<typeof mock.createMessage>[0]) {
  return (await api<Awaited<ReturnType<typeof mock.createMessage>>>('/api/messages', { method: 'POST', body: JSON.stringify(input) })) ?? mock.createMessage(input);
}

export async function upsertStation(input: Partial<Station> & { name: string }) {
  const path = input.id ? `/api/admin/stations/${encodeURIComponent(input.id)}` : '/api/admin/stations';
  const method = input.id ? 'PATCH' : 'POST';
  return (await api<Awaited<ReturnType<typeof mock.upsertStation>>>(path, { method, body: JSON.stringify(input) })) ?? mock.upsertStation(input);
}

export async function deleteStation(id: string) {
  const done = await api<{ ok: boolean }>(`/api/admin/stations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!done) await mock.deleteStation(id);
}

export async function setMessageStatus(id: string, status: MessageStatus) {
  const done = await api<{ ok: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  if (!done) await mock.setMessageStatus(id, status);
}

export async function setMessageOfficial(id: string, official: boolean) {
  const done = await api<{ ok: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ official }) });
  if (!done) await mock.setMessageOfficial(id, official);
}

export async function deleteMessage(id: string) {
  const done = await api<{ ok: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!done) await mock.deleteMessage(id);
}

export async function resetData() {
  await mock.resetData();
}
