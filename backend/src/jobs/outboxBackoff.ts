export function calculateOutboxBackoffSeconds(
  retryCount: number,
  randomValue: number = Math.random(),
): number {
  const base = 30;
  const max = 60 * 30;
  const exp = Math.min(max, base * Math.pow(2, Math.max(0, retryCount)));
  const jitterLimit = Math.max(1, Math.floor(exp * 0.2));
  const jitter = Math.floor(Math.max(0, Math.min(1, randomValue)) * jitterLimit);
  return Math.floor(Math.min(max, exp + jitter));
}
