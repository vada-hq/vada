import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, lockedCompleted } from '../policy/locks.js'

// 행사 방의 보관(DEC-90, 022 정한 것 26): 행사가 완료(마지막 완료 결재가 완료)이면 그 방은 새 메시지를 받지 않는다.
// 보이는 조건(업무의 '공지 만들기', 알림)과 막는 조건(보내기)이 이 규칙 하나를 쓴다.

// 그 행사의 방이 보관인가. 행사가 없으면(학생회 방) 아니다.
export async function isArchivedEvent(db: Pick<Db, 'select'>, eventId: string | null) {
  return eventId !== null && (await completedEventIdsAmong(db, [eventId])).size > 0
}

// 보내기 거래의 판정. 행사 행을 FOR SHARE로 잠근 뒤 보아 완료(행사 행 FOR NO KEY UPDATE)와 겹치면 하나로 정해진다.
// 끼룩이 글과 같은 '행사 행 → 내 참여 줄' 순서로 잠근다.
export async function assertRoomOpen(tx: Tx, room: { eventId: string | null }) {
  if (room.eventId && (await lockedCompleted(tx, [room.eventId])))
    throw new ApiError('ROOM_ARCHIVED')
}
