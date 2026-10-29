import {
  AlarmClock,
  CalendarClock,
  CalendarX2,
  type LucideIcon,
  Stamp,
  UserPlus,
} from 'lucide-react'
import type { C1rKind, C1rRow } from '../c1r-data'

// 줄 앞 이유 아이콘 원(토스 혜택 줄의 둥근 그림 자리). 그림이 이유를 말하고, 색은 범주 색(category-*)으로 원을 옅게 물들인다.
// 위험 빨강은 사실 글에만 쓰므로(명세 6절, K5) 원에는 빨강·분홍·주황 계열을 쓰지 않는다.
// 부서 미정·미배정은 둘 다 회장단이 배정하는 일이라 같은 그림을 쓴다.
type Reason = { icon: LucideIcon; tint: string }

const REASONS: Record<C1rKind, Reason> = {
  late: { icon: CalendarX2, tint: 'bg-category-7-soft text-category-7-strong' },
  today: { icon: AlarmClock, tint: 'bg-category-2-soft text-category-2-strong' },
  tomorrow: { icon: CalendarClock, tint: 'bg-category-5-soft text-category-5-strong' },
  approval: { icon: Stamp, tint: 'bg-category-1-soft text-category-1-strong' },
  'no-department': { icon: UserPlus, tint: 'bg-category-3-soft text-category-3-strong' },
  unassigned: { icon: UserPlus, tint: 'bg-category-3-soft text-category-3-strong' },
}

export const reasonOf = (row: C1rRow) => REASONS[row.kind]
