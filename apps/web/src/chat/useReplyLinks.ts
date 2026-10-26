import { useEffect, useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import { useLatest } from '@/lib/use-latest'
import { useReplyOpener } from './reply-open'
import type { Room, RoomState } from './useRoom'

// 원글의 답글 패널 열기(022 조각 11). 연 원글은 '새 답글'을 거두고, 주소(답글 알림)가 가리킨 원글은 방이 준비되면 한 번 연다.
export function useReplyLinks(
  roomId: string,
  state: RoomState,
  room: Room,
  replyTo: { messageId: string; key: string } | undefined,
) {
  const openReply = useReplyOpener()
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const ready = state.kind === 'ready' ? state : null
  const open =
    openReply && ready
      ? (messageId: string) => {
          setSeen(before => new Set(before).add(messageId))
          openReply({
            roomId,
            messageId,
            participants: ready.participants,
            readOnly: ready.room.readOnly,
            eventId: ready.room.eventId ?? null,
            onOriginal: room.replaceOriginal,
          })
        }
      : null
  const linked = replyTo && open ? replyTo.key : null
  const openLinked = useLatest(() => replyTo && open?.(replyTo.messageId))
  useEffect(() => {
    if (linked !== null) openLinked.current()
  }, [linked, openLinked])
  const readAt = ready?.readAt ?? null
  const fresh = (message: ChatMessage) =>
    message.lastReplyAt !== null &&
    !seen.has(message.id) &&
    (readAt === null || Date.parse(message.lastReplyAt) > Date.parse(readAt))
  return { onReply: open ? (message: ChatMessage) => open(message.id) : undefined, fresh }
}
