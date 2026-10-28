import { Badge } from '@/components/ui/badge'

// 홈 칩의 색 표(와이어프레임 HOME_PROTOTYPE_TONE). 색 값은 Badge의 tone이 한 곳에서 갖는다(와이어프레임 Chip과 같은 50·200·700 단계).
// 업무 보드와 같은 이름의 칩은 업무 보드 색이다: '지남'은 업무 카드의 지남 칩, '담당자 없음'은 업무 카드처럼 빨강(DEC-94, 와이어프레임 주황 대신).
// 행사 상태 칩은 이 표에 두지 않고 행사 화면 머리와 같은 부품(events/EventStatusChip)을 쓴다(DEC-93, 같은 행사는 같은 이름).
const HOME_CHIP_TONE = {
  지남: 'danger',
  '담당자 없음': 'danger',
} as const

type HomeChipLabel = keyof typeof HOME_CHIP_TONE

// 이유 칩('지남 2')과 줄 칩('담당자 없음').
export default function HomeChip({ label, count }: { label: HomeChipLabel; count?: number }) {
  return (
    <Badge tone={HOME_CHIP_TONE[label]}>{count === undefined ? label : `${label} ${count}`}</Badge>
  )
}

// 가까운 일정의 종류 태그(와이어프레임 HomePrototypeScheduleTag): 상태 칩과 갈라 테두리 없는 작은 태그다.
// 가까운 마감은 노랑이다. 빨강은 지남·막힘·음수에만 쓴다는 화면 공통 규칙을 따른다.
const SCHEDULE_TONE = {
  마감: 'warning',
  행사: 'info',
  '시험·학사': 'info',
  외부: 'neutral',
  기타: 'neutral',
} as const

export function ScheduleTag({ label }: { label: keyof typeof SCHEDULE_TONE }) {
  return (
    <Badge tone={SCHEDULE_TONE[label]} className="border-transparent px-1.5">
      {label}
    </Badge>
  )
}
