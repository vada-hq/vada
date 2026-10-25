import { EVENT_ENDED_NOTICE_DAYS, type EventDetail } from '@vada/contracts'
import { dayTime, monthDay } from '@/lib/korean-date-text'

// 행사 머리 요약 줄의 글(와이어프레임 EVT-02 EventWorkspaceHeader). 수는 서버가 센다(events/header.ts).

const NONE = '미정'

// 건강도: 지연 업무가 있으면 빨강, 담당자 없는 업무만 있으면 노랑, 없으면 초록이다.
// 와이어프레임은 앞의 근거 하나만 보이지만 둘 다 있으면 둘 다 싣는다(DEC-93 '근거 수와 함께'). '확인' 갈래는 없다(DEC-93).
export function healthOf({ overdue, unassigned }: EventDetail['health']) {
  const reasons = [
    overdue > 0 ? `지연 업무 ${overdue}개` : null,
    unassigned > 0 ? `담당자 없는 업무 ${unassigned}개` : null,
  ].filter(reason => reason !== null)
  if (reasons.length === 0) return { tone: 'success' as const, text: '안정 · 업무 이슈 없음' }
  return {
    tone: overdue > 0 ? ('danger' as const) : ('warning' as const),
    text: ['주의', ...reasons].join(' · '),
  }
}

// '담당 기획부, 재정부 · 김새내'. 부서는 이 행사의 끝나지 않은 업무에서 오고(DEC-25), 책임자는 만든 사람이다(DEC-79).
// 떠난 책임자는 서버가 준 표시 이름('떠난 운영진 N', DEC-54) 그대로다.
export const ownerLine = (event: Pick<EventDetail, 'departments' | 'owner'>) =>
  `담당 ${event.departments.join(', ') || NONE} · ${event.owner?.name ?? NONE}`

// 날짜만 있는 마감: '10월 28일 (화)'
const dueText = (date: string) => `${monthDay(date)} (${dayTime(`${date}T`).weekday})`

export function nextLabel(next: EventDetail['next']) {
  if (next === null) return '다음 일정 없음'
  if (next.kind === 'start') return `다음 일정 · ${dayTime(next.startsAt).text} 행사 시작`
  return `다음 일정 · ${dueText(next.dueDate)} ${next.title}`
}

// 완료를 잊지 않게 끝난 지 7일째부터 보인다(DEC-93). 알림과 같은 날수다.
export const endedLabel = (endedDays: number | null) =>
  endedDays !== null && endedDays >= EVENT_ENDED_NOTICE_DAYS ? `끝난 지 ${endedDays}일` : null
