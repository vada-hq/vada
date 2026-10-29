import {
  KOREAN_DATE_LENGTH,
  CALENDAR_KIND_LABELS,
  type HomeBoardEvent,
  type HomeBoardEventRef,
  type HomeCouncilBoard,
  type HomeFollowUp,
  type HomeMyTasks,
  type HomeUpcomingItem,
} from '@vada/contracts'
import { dueText, nextLabel } from '../events/event-header-view'
import { EVENT_SETTLED_LABEL } from '../events/event-view'
import { COUNCIL_TASK_LABEL } from '../tasks/task-view'
import { dDay } from './home-view'

// 회장단 홈(HOME-01C) 카드의 글. 수는 서버가 원래 화면과 같은 셈으로 준다(DEC-69). 여기서는 글만 만든다.

type Counts = HomeCouncilBoard['events']['counts']

// 행사 머리의 상태별 수: 행사 목록 상태 칩과 같은 이름(DEC-93). 행사가 하나도 없으면 없다(머리는 회색 '0개', 와이어프레임).
export const statusCountsLabel = ({ planning, ongoing, followUp }: Counts) =>
  planning + ongoing + followUp === 0
    ? undefined
    : `기획 중 ${planning} · 진행 중 ${ongoing} · 후속 정리 중 ${followUp}`

// 카드에 오른 행사(끝나지 않은 행사)의 수. 0이면 '진행할 행사 없음'이다.
export const openEventTotal = ({ planning, ongoing }: Counts) => planning + ongoing
// '전체 {n}개 보기'의 수: 머리 상태별 수의 합(완료하지 않은 행사 모두). 머리 수와 링크 수가 어긋나 보이지 않게 한다.
export const allEventTotal = (counts: Counts) => openEventTotal(counts) + counts.followUp

const dayOf = (value: string) => dueText(value.slice(0, KOREAN_DATE_LENGTH))

// '10월 30일 (금) · D-4'(DEC-95). 남은 날은 예정 행사만이고(진행 중은 칩이 말한다), 날짜 미정은 '미정'이다.
export function eventDayLabel(
  event: Pick<HomeBoardEventRef, 'startsAt' | 'status'>,
  today: string,
) {
  if (event.startsAt === null) return '미정'
  const day = dayOf(event.startsAt)
  return event.status === 'upcoming' ? `${day} · ${dDay(today, event.startsAt)}` : day
}

// 행사 카드 맨 아래: 업무 마감이면 와이어프레임 이름 '다음 마감', 행사 시작이 더 이르면 행사 머리와 같은 '다음 일정'이다.
export const nextDeadlineLabel = (next: HomeBoardEvent['next']) =>
  next?.kind === 'task' ? `다음 마감 · ${dueText(next.dueDate)} ${next.title}` : nextLabel(next)

// 남은 정리(DEC-93 '끝나지 않은 업무 N · 정산 N'). 다 0이면 '완료 가능'이다.
export const remainingTidyLabel = ({ tasks, settlement }: HomeFollowUp['remaining']) =>
  tasks === 0 && settlement === 0
    ? EVENT_SETTLED_LABEL
    : `남은 정리: 업무 ${tasks} · 정산 ${settlement}`

export const ATTENTION_CHIP = { overdue: '지남', unassigned: '담당자 없음' } as const

// 인사 카드 아래 바로가기: '내 업무 4', 지난 것이 있으면 '내 업무 4 · 지남 1'(DEC-95).
export const myTasksLabel = ({ open, overdue }: HomeMyTasks) =>
  overdue > 0 ? `내 업무 ${open} · 지남 ${overdue}` : `내 업무 ${open}`

// 가까운 일정 한 줄: 제목, 메타, 오른쪽 종류 칩. 업무 마감과 참가 신청 마감은 '마감', 행사 시작은 '행사'다.
export function upcomingParts(item: HomeUpcomingItem) {
  const date = dueText(item.date)
  if (item.kind === 'schedule_item')
    return {
      date,
      title: item.item.title,
      meta: [item.time ?? '종일'],
      chip: CALENDAR_KIND_LABELS[item.item.type],
    }
  if (item.kind === 'task_due') {
    const where = item.task.event?.name ?? item.task.department?.name ?? COUNCIL_TASK_LABEL
    return { date, title: item.task.title, meta: [where, '업무 마감'], chip: '마감' as const }
  }
  if (item.kind === 'registration_close')
    return {
      date,
      title: `${item.event.name} 신청 마감`,
      meta: [item.time, '참가 신청'],
      chip: '마감' as const,
    }
  return { date, title: item.event.name, meta: [item.time, '행사 시작'], chip: '행사' as const }
}
