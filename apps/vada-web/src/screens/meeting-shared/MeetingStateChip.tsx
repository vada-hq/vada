import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'

interface MeetingStateChipProps {
  label: string
  tone: string
}

/** 회의 조회 화면들이 공통으로 그리는 상태 딱지. */
export function MeetingStateChip({ label, tone }: MeetingStateChipProps) {
  if (label === '') {
    return null
  }
  return (
    <span
      data-design-state
      data-design-rule="state-chip"
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[tone] ?? NEUTRAL_CHIP}`}
    >
      {label}
    </span>
  )
}
