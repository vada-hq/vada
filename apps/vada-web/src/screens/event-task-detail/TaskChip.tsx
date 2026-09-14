import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'

export function TaskChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
        STATE_CHIP[tone] ?? NEUTRAL_CHIP
      }`}
    >
      {label}
    </span>
  )
}
