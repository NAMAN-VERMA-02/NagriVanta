import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, appendImage } from './api';

// Offline outbox: reports that could not reach the server are stored here and retried later.
// Photos are referenced by their local file URI, which stays valid in the app's cache.
const KEY = 'outbox';
const listeners = new Set();
export const onOutboxChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const read = async () => JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
const write = async (items) => { await AsyncStorage.setItem(KEY, JSON.stringify(items)); listeners.forEach((fn) => fn(items.length)); };

export async function queueReport(fields, photos) {
  await write([...(await read()), { fields, photos: photos.map(({ uri, mimeType, fileName }) => ({ uri, mimeType, fileName })), queuedAt: Date.now() }]);
}

export const queuedCount = async () => (await read()).length;

let busy = false;
export async function flushOutbox() {
  if (busy) return 0;
  busy = true;
  let sent = 0;
  try {
    const items = await read();
    const left = [];
    for (const [i, item] of items.entries()) {
      try {
        const fd = new FormData();
        Object.entries(item.fields).forEach(([k, v]) => v !== '' && v != null && fd.append(k, String(v)));
        for (const [j, p] of item.photos.entries()) await appendImage(fd, 'images', p, j);
        await api('/complaints', { method: 'POST', body: fd });
        sent += 1;
      } catch (err) {
        if (err.network) { left.push(...items.slice(i)); break; } // still offline: keep the rest
        // a validation error will never succeed; drop it instead of retrying forever
      }
    }
    await write(left);
  } finally {
    busy = false;
  }
  return sent;
}
