// 서버 메모리 캐시. Render 인스턴스가 하나라 메모리로 맞다(http/rate-limit.ts와 같은 전제).
// 넘치면 가장 먼저 넣은 것부터 버린다(Map은 넣은 차례를 지킨다).
export function createExpiringCache<T>({ ttlMs, max }: { ttlMs: number; max: number }) {
  const entries = new Map<string, { value: T; storedAt: number }>()
  return {
    get(key: string, now: Date): T | undefined {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (now.getTime() - entry.storedAt < ttlMs) return entry.value
      entries.delete(key)
      return undefined
    },
    set(key: string, value: T, now: Date) {
      entries.delete(key)
      if (entries.size >= max) entries.delete(entries.keys().next().value!)
      entries.set(key, { value, storedAt: now.getTime() })
    },
  }
}
