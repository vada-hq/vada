import { CalendarDays, Circle, Flag, Globe, GraduationCap, Users } from 'lucide-react'
import type { CalendarKind } from '@vada/contracts'

// 색과 아이콘을 같이 써서 종류를 색만으로 구별하지 않는다(DEC-102, WCAG 1.4.1).
export const KIND_STYLE = {
  event: { Icon: CalendarDays, text: 'text-kind-event', background: 'bg-kind-event-soft' },
  meeting: { Icon: Users, text: 'text-kind-meeting', background: 'bg-kind-meeting-soft' },
  deadline: { Icon: Flag, text: 'text-kind-deadline', background: 'bg-kind-deadline-soft' },
  academic: {
    Icon: GraduationCap,
    text: 'text-kind-academic',
    background: 'bg-kind-academic-soft',
  },
  external: { Icon: Globe, text: 'text-kind-external', background: 'bg-kind-external-soft' },
  other: { Icon: Circle, text: 'text-fg-secondary', background: 'bg-surface-muted' },
} satisfies Record<CalendarKind, unknown>
