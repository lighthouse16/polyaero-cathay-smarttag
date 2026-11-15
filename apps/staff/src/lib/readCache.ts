// ponytail: bounded per-process cache; cold serverless instances still fetch upstream.
// Passenger records never enter public CDN or browser storage.
const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

export function clearReadCache(): void {
  entries.clear();
}

export function cachedRead<T>(key: string, ttlMs: number, load: () => Promise<T>, fresh = false): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (!fresh && hit && hit.expiresAt > now) return hit.value as Promise<T>;
  for (const [k, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(k);
  }
  if (entries.size >= 128) entries.delete(entries.keys().next().value!);
  const entry = { expiresAt: now + ttlMs, value: Promise.resolve().then(load) };
  entries.set(key, entry);
  void entry.value.catch(() => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return entry.value;
}
