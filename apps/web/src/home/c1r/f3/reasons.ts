import {
  AlarmClock,
  CalendarClock,
  CalendarX2,
  type LucideIcon,
  Stamp,
  UserPlus,
} from 'lucide-react'
import type { C1rKind, C1rRow } from '../c1r-data'

// 띠의 이유 알약 다섯 갈래. 부서 미정·미배정은 둘 다 회장단이 배정하는 일이라 '배정' 하나로 묶는다.
// 알약과 줄 앞 아이콘이 같은 그림을 써서, 띠에서 본 이유를 줄에서 다시 찾게 한다.
export type Reason = {
  key: string
  label: string
  icon: LucideIcon
  urgent: boolean
  kinds: C1rKind[]
}

export const REASONS: Reason[] = [
  { key: 'late', label: '지남', icon: CalendarX2, urgent: true, kinds: ['late'] },
  { key: 'today', label: '오늘 마감', icon: AlarmClock, urgent: true, kinds: ['today'] },
  { key: 'tomorrow', label: '내일 마감', icon: CalendarClock, urgent: false, kinds: ['tomorrow'] },
  { key: 'approval', label: '결재 대기', icon: Stamp, urgent: false, kinds: ['approval'] },
  {
    key: 'assign',
    label: '배정',
    icon: UserPlus,
    urgent: false,
    kinds: ['no-department', 'unassigned'],
  },
]

export const reasonOf = (row: C1rRow) =>
  REASONS.find(reason => reason.kinds.includes(row.kind)) ?? REASONS[0]

// 0건인 이유는 띠에 싣지 않는다. 알약 수의 합 = data.total(미배정 줄도 1건, K6과 같은 셈).
export const countReasons = (rows: C1rRow[]) =>
  REASONS.map(reason => ({
    reason,
    count: rows.filter(row => reason.kinds.includes(row.kind)).length,
  })).filter(item => item.count > 0)
