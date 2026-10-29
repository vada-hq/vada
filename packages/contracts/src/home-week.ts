import type { ScheduleType } from './calendar.js'
import type { MeetingAction } from './meetings.js'

// 회장단 홈 ⑤ '이번 주'(c35 안 b 확정, 시연 조각 ㉯): 오늘부터 7일째까지의 외부·마감 일정과 다음 회의 하나.
// 행사 일정(②)·업무 마감(①③)·학사는 싣지 않는다.

// 줄 수 상한. 넘으면 회의 줄은 남기고 일정을 날짜순으로 채운다.
export const HOME_WEEK_ROWS = 3

export type HomeWeekItem =
  | {
      kind: 'meeting'
      // heldAt은 한국 시각(YYYY-MM-DDTHH:mm). actions는 회의 화면과 같다(안건 올리기는 meeting.minutes가 있을 때만).
      meeting: {
        id: string
        title: string
        heldAt: string
        agendaCount: number
        actions: MeetingAction[]
      }
    }
  | {
      kind: 'schedule'
      item: { id: string; title: string; type: Extract<ScheduleType, 'external' | 'deadline'> }
      // 한국 날짜와 시각('HH:mm', 종일이면 null). 이어지는 일정도 원래 시작이다(DEC-102).
      date: string
      time: string | null
    }

export interface HomeWeek {
  // 날짜순(같은 날은 종일 먼저), HOME_WEEK_ROWS줄까지
  items: HomeWeekItem[]
  total: number
}
