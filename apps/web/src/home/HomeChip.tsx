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
// 다가오는 마감(업무 마감, 참가 신청 마감)은 빨강, 행사 시작은 파랑(와이어프레임 '참석'과 같은 색)이다.
const SCHEDULE_TONE = { 마감: 'danger', 행사: 'info' } as const

export function ScheduleTag({ label }: { label: keyof typeof SCHEDULE_TONE }) {
  return (
    <Badge tone={SCHEDULE_TONE[label]} className="border-transparent px-1.5">
      {label}
    </Badge>
  )
}
