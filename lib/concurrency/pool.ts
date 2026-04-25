/**
 * Bounded parallel execution for server routes (no extra deps; webpack-safe vs `p-limit` ESM).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length
  if (n === 0) return []
  const cap = Math.max(1, Math.min(concurrency, n))
  const out: R[] = new Array(n)
  let cursor = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++
      if (i >= n) return
      out[i] = await mapper(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: cap }, () => worker()))
  return out
}
