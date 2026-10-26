import {
  KOREAN_DATE_LENGTH,
  koreanDateOf,
  type CouncilView,
  type HomeMyTasks,
  type HomeParticipation,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import type { RoomListState } from '../chat/useRoomList'
import { dueText } from '../events/event-header-view'

// 부원 홈(HOME-01M) 카드의 글. 수와 차례는 서버가 원래 화면과 같은 셈으로 준다(DEC-69). 여기서는 글만 만든다.

// 학생회 직급도 부서도 없는 운영진(첫날 막 들어온 사람)이면 홈 맨 위에 '부서 배정 전' 띠를 둔다(DEC-87, 기능 020 정한 것 12).
// 학생회 읽기의 내 소속을 그대로 읽는다. 배정되면 다음 읽기에서 사라진다.
export const awaitingDepartment = ({ councilRank, departments }: CouncilView['me']) =>
  councilRank === null && departments.length === 0

// 참여 행사 줄의 날짜: '10월 28일 (수)', 날짜 미정이면 '미정'(와이어프레임 줄은 날짜만, D-N은 인사 카드 타일이 말한다).
export const participationDay = ({ event }: HomeParticipation) =>
  event.startsAt === null ? '미정' : dueText(event.startsAt.slice(0, KOREAN_DATE_LENGTH))

// 참여 행사 줄 맨 아래: 그 부서 업무 가운데 다음 마감(DEC-95).
export const participationNext = ({ next }: HomeParticipation) =>
  next === null ? '다음 마감 없음' : `다음 마감 · ${dueText(next.dueDate)} ${next.title}`

// '내 업무·메시지' 첫 줄: '내 업무 {n}'과 가장 가까운 마감(DEC-95). 맡은 업무가 없으면 '맡은 업무 없음'이다.
export function myTasksRow({ open, nearest }: HomeMyTasks) {
  if (open === 0) return { title: '맡은 업무 없음', meta: [], overdue: false }
  // nearest는 마감이 있는 업무 가운데 가장 이른 것이라 마감 없는 업무만 있으면 없다.
  if (nearest === null || nearest.dueDate === null)
    return { title: `내 업무 ${open}`, meta: [], overdue: false }
  const meta = [`가장 가까운 마감 ${dueText(nearest.dueDate)}`, nearest.title]
  return { title: `내 업무 ${open}`, meta, overdue: nearest.overdue }
}

// '내 업무·메시지' 둘째 줄: 메시지함과 같은 방 목록으로 센 안 읽은 방 수(DEC-95). 목록을 읽기 전이나 실패면 0이 아니라 '집계 전'이다.
export function unreadRoomsLabel(rooms: RoomListState) {
  if (rooms.kind !== 'ready') return '안 읽은 방 집계 전'
  const count = rooms.data.rooms.filter(room => room.unread > 0).length
  return count === 0 ? '안 읽은 메시지 없음' : `안 읽은 방 ${count}`
}

// 내 요청 줄의 메타: '{행사} · 10월 20일 (화) 요청'(낸 날, 한국 날짜).
export const requestParts = ({ event, createdAt }: PurchaseRequestSummary) => [
  event?.name ?? null,
  `${dueText(koreanDateOf(new Date(createdAt)))} 요청`,
]
