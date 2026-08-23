import type { ReactNode } from 'react'

interface ProgressBarProps {
  percent: number
  // design이 라벨을 색이 다른 두 줄기로 그리는 자리가 있어(준비 62% · 지연 업무 1건)
  // 문자열이 아니라 조각을 받는다. 보조기술에 읽힐 이름은 ariaLabel이 따로 갖는다.
  label?: ReactNode
  ariaLabel?: string
  // 막대가 남는 폭을 다 쓰는가. 디자인에서 갈린다: 행사 카드의 막대는
  // 112→128px 고정이고(16:163) 라벨이 뒤에 붙지만, 재정 요약의 막대는
  // 카드 폭을 채운다.
  fill?: boolean
}

// 진행률 막대. 높이 5.25→h-1.5, 트랙 gray-200, 채움 blue-600, pill radius.
export function ProgressBar({ percent, label, ariaLabel, fill = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        className={`h-1.5 overflow-hidden rounded-full bg-gray-200 ${
          fill ? 'min-w-0 flex-1' : 'w-32 shrink-0'
        }`}
      >
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${clamped}%` }} />
      </div>
      {label && <span className="min-w-0 text-xs font-medium">{label}</span>}
    </div>
  )
}
