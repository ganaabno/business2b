const pendingRequests = new Map<string, Promise<any>>();
const requestTimestamps = new Map<string, number>();

export interface DedupOptions {
  windowMs?: number;
}

const defaultWindowMs = 2000;

export function dedupe<T>(
  key: string,
  fn: () => Promise<T>,
  options: DedupOptions = {}
): Promise<T> {
  const { windowMs = defaultWindowMs } = options;
  const now = Date.now();

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const lastTimestamp = requestTimestamps.get(key);
  if (lastTimestamp && now - lastTimestamp < windowMs) {
    return Promise.reject(new Error("Request deduplicated"));
  }

  requestTimestamps.set(key, now);

  const promise = fn()
    .finally(() => {
      pendingRequests.delete(key);
      requestTimestamps.delete(key);
    }) as Promise<T>;

  pendingRequests.set(key, promise);
  return promise;
}

export function cancelDedup(key: string): void {
  pendingRequests.delete(key);
  requestTimestamps.delete(key);
}

export function clearDedup(): void {
  pendingRequests.clear();
  requestTimestamps.clear();
}

export function isDeduped(key: string): boolean {
  return pendingRequests.has(key);
}
