// 방을 보는 중인 사람(기능 003 '알림 받을 사람'). 그 방의 최신 쪽을 읽은 사람은 10초 동안 알림을 받지 않는다.
// 상태는 서버 메모리라 Render 인스턴스가 하나일 때만 맞다. 사라져도 알림이 한 번 더 갈 뿐이다.
const PRESENCE_WINDOW_MS = 10_000
// 쓰지 않는 방의 기록이 쌓이지 않게, 이 수를 넘으면 지난 기록을 한 번에 쓸어 낸다.
const SWEEP_AT = 1000

export function createPresence(windowMs = PRESENCE_WINDOW_MS) {
  const seenAt = new Map<string, number>()
  const keyOf = (roomId: string, memberId: string) => `${roomId}:${memberId}`
  return {
    see(roomId: string, memberId: string, now: Date) {
      const at = now.getTime()
      if (seenAt.size >= SWEEP_AT)
        for (const [key, time] of seenAt) if (time <= at - windowMs) seenAt.delete(key)
      seenAt.set(keyOf(roomId, memberId), at)
    },
    isViewing(roomId: string, memberId: string, now: Date) {
      const time = seenAt.get(keyOf(roomId, memberId))
      return time !== undefined && time > now.getTime() - windowMs
    },
  }
}
