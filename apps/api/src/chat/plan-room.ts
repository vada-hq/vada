import { isNull } from 'drizzle-orm'
import { chatRoom } from '../db/schema.js'

// 학생회 편성 방(전체방, 회장단방, 부서방, 1:1)은 행사가 정한 방이 아니다. 행사방은 event_id가 있다.
// 편성 방을 고르는 조회(방 맞추기, 공지)는 모두 이 조건을 쓴다. 빠뜨리면 행사방이 편성 방으로 잡힌다.
export const isPlanRoom = isNull(chatRoom.eventId)
