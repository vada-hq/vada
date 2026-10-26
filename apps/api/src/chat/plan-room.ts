import { and, eq, isNull } from 'drizzle-orm'
import { chatRoom } from '../db/schema.js'

// 학생회 편성 방(공지방, 회장단방, 부서방, 1:1)은 행사가 정한 방이 아니다. 행사방은 event_id가 있다.
// 편성 방을 고르는 조회(방 맞추기)는 모두 이 조건을 쓴다. 빠뜨리면 행사방이 편성 방으로 잡힌다.
export const isPlanRoom = isNull(chatRoom.eventId)

// 공지방(DEC-90): 공간마다 하나인 all_members 방이다(학생회 공지방은 event_id가 없고 행사 공지방은 있다).
// 공지는 공지방에 보낸 보통 메시지다. 들어오기 전 보이기(visibleMessage)와 업무의 공지 만들기(sendMessage)가 이 조건을 쓴다.
// chat_room을 합친 조회에서 쓴다.
export const inNoticeRoom = eq(chatRoom.type, 'all_members')

// 학생회 공간의 공지방. 행사 공지방이 없을 때 끼룩이 글이 오르는 곳이다(행사에 이은 업무의 공지는 그 행사 공지방, chat/send.ts).
export const inCouncilNoticeRoom = and(inNoticeRoom, isPlanRoom)
