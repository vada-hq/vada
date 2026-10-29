import {
  AlarmClock,
  CalendarClock,
  CalendarX2,
  type LucideIcon,
  Stamp,
  UserPlus,
} from 'lucide-react'
import type { C1rKind } from '../c1r-data'

// 줄 앞 이유 아이콘(토스 혜택 줄의 둥근 그림 자리). 원은 중립(회색 면 + 진회색 그림)이다.
// f7은 이유마다 범주 색을 입혔지만, 그 다섯 색은 급한 정도 차례도 아니고 이유는 그림과 사실 글이 이미 말한다(장식).
// 줄에 사람 얼굴(사람마다 범주 색)이 들어오므로 원까지 색을 쓰면 두 색 체계가 한 줄에서 겹쳐 '같은 색 = 같은 사람'이 흐려진다.
export const REASON_ICON: Record<C1rKind, LucideIcon> = {
  late: CalendarX2,
  today: AlarmClock,
  tomorrow: CalendarClock,
  approval: Stamp,
  'no-department': UserPlus,
  unassigned: UserPlus,
}

// 접힌 줄을 '전체 보기' 옆에 이유별로 셀 때 쓰는 이름(배정 줄은 늘 보이므로 접히지 않는다)
export const REASON_NAME: Record<C1rKind, string> = {
  late: '지남',
  today: '오늘 마감',
  tomorrow: '내일 마감',
  approval: '결재 대기',
  'no-department': '부서 미정',
  unassigned: '미배정',
}
