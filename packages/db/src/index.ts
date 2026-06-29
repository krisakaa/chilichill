import type { Message, MessageStatus, ReactionType, Station } from '@chili/shared';
import * as mock from './mock';

export type MessagePage = mock.MessagePage;
export type MessagePageOpts = mock.MessagePageOpts;

function canUseApi() {
  return typeof window !== 'undefined';
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

function pageQuery(opts?: MessagePageOpts) {
  const params = new URLSearchParams();
  if (opts?.visitorId) params.set('visitorId', opts.visitorId);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  if (opts?.order) params.set('order', opts.order);
  return params;
}

function normalizePage(result: MessagePage | Message[] | null, fallback: MessagePage): MessagePage {
  if (!result) return fallback;
  if (Array.isArray(result)) return { items: result, nextOffset: null, hasMore: false };
  return result;
}

export async function listMessages(stationId: string, opts?: MessagePageOpts) {
  if (opts?.includeHidden) return mock.listMessages(stationId, opts);
  const params = pageQuery(opts);
  params.set('stationId', stationId);
  const fallback = await mock.listMessages(stationId, opts);
  return normalizePage(await api<MessagePage | Message[]>(`/api/messages?${params.toString()}`), fallback);
}

export async function listMessagesForStations(stationIds: string[], opts?: MessagePageOpts) {
  if (opts?.includeHidden) return mock.listMessagesForStations(stationIds, opts);
  const params = pageQuery(opts);
  params.set('stationIds', stationIds.join(','));
  const fallback = await mock.listMessagesForStations(stationIds, opts);
  return normalizePage(await api<MessagePage | Message[]>(`/api/messages?${params.toString()}`), fallback);
}

export async function listAllPublicMessages(opts?: MessagePageOpts) {
  const params = pageQuery(opts);
  params.set('all', '1');
  const fallback = await mock.listAllPublicMessages(opts);
  return normalizePage(await api<MessagePage | Message[]>(`/api/messages?${params.toString()}`), fallback);
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

export async function toggleMessageReaction(messageId: string, type: ReactionType, visitorId: string) {
  return (await api<Awaited<ReturnType<typeof mock.toggleMessageReaction>>>(`/api/messages/${encodeURIComponent(messageId)}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ type, visitorId }),
  })) ?? mock.toggleMessageReaction(messageId, type, visitorId);
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

export async function updateMessage(id: string, patch: Partial<Pick<Message, 'author' | 'body' | 'cityTag' | 'mood' | 'rating' | 'status' | 'official'>>) {
  const done = await api<{ ok: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (!done) await mock.updateMessage(id, patch);
}

export async function deleteMessage(id: string) {
  const done = await api<{ ok: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!done) await mock.deleteMessage(id);
}

export async function resetData() {
  await mock.resetData();
}
