import { CalendarDays, Circle, Flag, Globe, GraduationCap, Users } from 'lucide-react'
import type { CalendarKind } from '@vada/contracts'

// 색과 아이콘을 같이 써서 종류를 색만으로 구별하지 않는다(DEC-102, WCAG 1.4.1).
export const KIND_STYLE = {
  event: { Icon: CalendarDays, text: 'text-emerald-700', background: 'bg-emerald-100' },
  meeting: { Icon: Users, text: 'text-violet-700', background: 'bg-violet-100' },
  deadline: { Icon: Flag, text: 'text-orange-700', background: 'bg-orange-100' },
  academic: { Icon: GraduationCap, text: 'text-blue-700', background: 'bg-blue-100' },
  external: { Icon: Globe, text: 'text-rose-700', background: 'bg-rose-100' },
  other: { Icon: Circle, text: 'text-gray-700', background: 'bg-gray-100' },
} satisfies Record<CalendarKind, unknown>
