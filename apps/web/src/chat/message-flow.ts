import { koreanDateOf, type ChatMessage } from '@vada/contracts'
import { dateLabel } from './chat-view'

// 같은 사람이 이 시간 안에 이어 쓴 메시지는 이름과 시각을 한 번만 보인다(Mattermost·Element·Rocket.Chat 기본 5분).
export const CONTINUE_MS = 300_000

export type FlowItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'unread'; key: string }
  | { kind: 'message'; key: string; message: ChatMessage; continued: boolean }

const DAY_MS = 86_400_000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 날짜 구분선의 글: 오늘, 어제, 그 전은 날짜와 요일(한국 날짜).
export function dayLabel(iso: string, now: Date) {
  const day = koreanDateOf(new Date(iso))
  if (day === koreanDateOf(now)) return '오늘'
  if (day === koreanDateOf(new Date(now.getTime() - DAY_MS))) return '어제'
  const weekday = WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? ''
  return `${dateLabel(iso, now)} (${weekday})`
}

// 처음 안 읽은 메시지: 끝에서부터 남이 보낸 메시지를 안 읽은 수만큼 거슬러 간 자리. 흐름에 없으면 없다.
export function firstUnreadId(messages: ChatMessage[], unread: number, meId: string) {
  if (unread <= 0) return null
  let count = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message && message.senderId !== meId) count += 1
    if (count === unread) return message?.id ?? null
  }
  return null
}

const continues = (before: ChatMessage | undefined, message: ChatMessage) =>
  before !== undefined &&
  before.senderId !== null &&
  before.senderId === message.senderId &&
  new Date(message.sentAt).getTime() - new Date(before.sentAt).getTime() < CONTINUE_MS

// 메시지 흐름에 날짜 구분선, 새 메시지 경계, 이어 쓴 메시지 묶기를 더한다.
export function flowOf(messages: ChatMessage[], now: Date, unreadFrom: string | null) {
  const items: FlowItem[] = []
  let before: ChatMessage | undefined
  for (const message of messages) {
    const day = koreanDateOf(new Date(message.sentAt))
    const newDay = before === undefined || koreanDateOf(new Date(before.sentAt)) !== day
    if (newDay)
      items.push({ kind: 'date', key: `date-${day}`, label: dayLabel(message.sentAt, now) })
    const boundary = message.id === unreadFrom
    if (boundary) items.push({ kind: 'unread', key: 'unread' })
    const continued = !newDay && !boundary && continues(before, message)
    items.push({ kind: 'message', key: message.id, message, continued })
    before = message
  }
  return items
}
