import { useSyncExternalStore } from 'react'
import { RECENT_NOTICE_COUNT, type ChatMessage } from '@vada/contracts'

// 기기가 학생회마다 공지를 어디까지 봤는지 기억한다. 서버에는 공지 읽음이 없어 다른 기기에서 본 것은 모른다.
// 저장소를 못 쓰는 브라우저에서는 이 화면을 연 동안만 기억한다.
const PREFIX = 'vada.chat.notices-seen.'
const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function seenAt(councilId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + councilId) ?? memory.get(councilId) ?? null
  } catch {
    return memory.get(councilId) ?? null
  }
}

function subscribe(change: () => void) {
  listeners.add(change)
  return () => listeners.delete(change)
}

// 공지 모아 보기를 열면 가장 최근 공지까지 본 것이다. 공지는 최근 것부터 온다.
export function markNoticesSeen(councilId: string, notices: ChatMessage[]) {
  const latest = notices[0]?.sentAt
  const seen = seenAt(councilId)
  if (latest === undefined || (seen !== null && Date.parse(seen) >= Date.parse(latest))) return
  memory.set(councilId, latest)
  try {
    window.localStorage.setItem(PREFIX + councilId, latest)
  } catch {
    // 가득 찼거나 막혔다. 이 화면을 연 동안만 기억한다.
  }
  for (const change of listeners) change()
}

// 아직 안 본 공지: 본 시각보다 뒤에 올라왔고 내가 쓰지 않은 것.
export function useNewNotices(councilId: string, notices: ChatMessage[], meId: string) {
  const seen = useSyncExternalStore(subscribe, () => seenAt(councilId))
  return notices.filter(
    notice =>
      notice.senderId !== meId && (seen === null || Date.parse(notice.sentAt) > Date.parse(seen)),
  )
}

// 방 목록은 최근 공지 몇 개만 받으므로, 받은 것이 모두 새것이면 더 있을 수 있다.
export const newNoticeLabel = (count: number) =>
  count >= RECENT_NOTICE_COUNT ? `${RECENT_NOTICE_COUNT}+` : String(count)
