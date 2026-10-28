import type { ChatMessage } from '@vada/contracts'
import { isRoomLost } from './chat-api'
import { readMessages, readNewer, type RoomAt } from './room-state'

type OnPage = (messages: ChatMessage[]) => boolean

function olderCursor(page: ChatMessage[], before: string | undefined) {
  const next = page[0]?.id
  return next === before ? undefined : next
}

// 처음 읽은 줄까지 거슬러 확인해, 화면에 남은 오래된 메시지의 삭제도 다음 읽기에 반영한다.
async function refreshLoaded(where: RoomAt, firstId: string, onPage: OnPage) {
  let before: string | undefined
  for (;;) {
    const result = await readMessages(where, before ? { before } : undefined)
    if (!result.ok) return isRoomLost(result.status) ? 'lost' : 'failed'
    const page = result.data.messages
    const index = page.findIndex(item => item.id === firstId)
    if (!onPage(page.slice(Math.max(0, index)))) return 'done'
    if (index >= 0 || !result.data.hasOlder) return 'done'
    const next = olderCursor(page, before)
    if (!next) return 'failed'
    before = next
  }
}

export async function readRoomUpdates(
  where: RoomAt,
  cursor: { firstId: string | undefined; lastId: string | undefined },
  onPage: OnPage,
  onRefresh: OnPage,
) {
  let active = true
  const accept: OnPage = page => (active = onPage(page))
  const outcome = await readNewer(where, cursor.lastId, accept)
  if (outcome !== 'done' || !cursor.firstId || !active) return outcome
  return refreshLoaded(where, cursor.firstId, onRefresh)
}
