// 계정마다 센다. 상태는 서버 메모리라 Render 인스턴스가 하나일 때만 맞다(기능 003 '서버 메모리').
// 창 안의 시각을 모두 기억하는 방식이라 창 경계에서 두 배가 한꺼번에 지나가지 않는다.

// 쓰지 않는 계정의 기록이 쌓이지 않게, 이 수를 넘으면 지난 기록을 한 번에 쓸어 낸다.
const SWEEP_AT = 1000

export interface RateLimiter {
  // 이번 한 번을 센다. 한도를 넘으면 false이고 센 것으로 치지 않는다.
  take(key: string, now: Date): boolean
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>()
  const fresh = (times: number[], at: number) => times.filter(time => time > at - windowMs)
  const limiter: RateLimiter = {
    take(key, now) {
      const at = now.getTime()
      if (hits.size >= SWEEP_AT)
        for (const [other, times] of hits) {
          const kept = fresh(times, at)
          if (kept.length) hits.set(other, kept)
          else hits.delete(other)
        }
      const kept = fresh(hits.get(key) ?? [], at)
      if (kept.length >= limit) {
        hits.set(key, kept)
        return false
      }
      hits.set(key, [...kept, at])
      return true
    },
  }
  return limiter
}
