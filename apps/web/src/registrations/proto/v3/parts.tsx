import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import { cn } from '@/lib/utils'
import { ICON_CIRCLE, QR_SIZE, STATE_CIRCLE } from './tokens'

// v3 '설정 줄과 무대 모양'이 같이 쓰는 작은 부품: 상태 알약, 중립 아이콘 원, 상태 원(✓/빈 원), 작은 알약, QR 그림.

type PillTone = 'success' | 'warning' | 'neutral'
const PILL_TONE: Record<PillTone, { box: string; dot: string }> = {
  success: { box: 'bg-success-surface text-success', dot: 'bg-success-mark' },
  warning: { box: 'bg-warning-surface text-warning', dot: 'bg-warning-mark' },
  neutral: { box: 'bg-surface-muted text-fg-tertiary', dot: 'bg-fg-subtle' },
}

// 양식 상태 알약: 점 + 글자(색만으로 말하지 않게 글자를 늘 둔다).
export function StatePill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const style = PILL_TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        style.box,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', style.dot)} />
      {children}
    </span>
  )
}

// 줄 안의 작은 알약('필수', '입력 필요', '잠김')
export function TinyPill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'danger' | 'info'
  children: ReactNode
}) {
  const box = {
    neutral: 'bg-surface-muted text-fg-tertiary',
    danger: 'bg-danger-surface text-danger',
    info: 'bg-primary-surface text-primary-strong',
  }[tone]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        box,
      )}
    >
      {children}
    </span>
  )
}

// 중립 아이콘 원(회장단 홈 부품 가족과 같은 회색 원)
export function IconCircle({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-tertiary [&_svg]:size-4',
        ICON_CIRCLE,
      )}
    >
      {children}
    </span>
  )
}

// 끝남(초록 원 + ✓) / 아직(빈 원). 읽는 글은 label로 둔다.
export function StateMark({ done, label }: { done: boolean; label: string }) {
  return done ? (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-success-emphasis text-white',
        STATE_CIRCLE,
      )}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
    </span>
  ) : (
    <span
      role="img"
      aria-label={label}
      className={cn('shrink-0 rounded-full border-2 border-border-strong bg-white', STATE_CIRCLE)}
    />
  )
}

// 흰 바탕 QR(스캐너가 읽도록 바탕은 늘 흰색, matrix에 여백 2칸 + 타일 안쪽 여백으로 4칸쯤)
export function QrImage({ text, label }: { text: string; label: string }) {
  const matrix = qrMatrix(text)
  const size = matrix.length
  return (
    <svg
      role="img"
      aria-label={label}
      data-measure="qr"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn('bg-white', QR_SIZE)}
    >
      <path d={qrPath(matrix)} className="fill-black" />
    </svg>
  )
}
