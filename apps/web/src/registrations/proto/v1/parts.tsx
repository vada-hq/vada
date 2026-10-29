import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { radius, shadow, size, space, TOAST_MS, type } from './tokens'

// v1 '카드 더미 모양'이 세 화면에서 같이 쓰는 작은 부품.

// 회색 쟁반(회장단 홈 부품 가족). 그 위에 흰 카드를 쌓는다.
export function Tray({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface-muted', radius.tray, space.tray, className)}>{children}</div>
  )
}

// 쟁반 위 흰 카드 한 장
export function Sheet({
  children,
  className,
  raised = false,
}: {
  children: ReactNode
  className?: string
  raised?: boolean
}) {
  return (
    <div
      className={cn(
        'relative bg-white',
        radius.card,
        raised ? shadow.raised : shadow.card,
        className,
      )}
    >
      {children}
    </div>
  )
}

// 중립 아이콘 원(회장단 홈 이유 아이콘 원과 같은 가족). 고친 카드는 강조색 면이 된다.
export function IconCircle({
  children,
  active = false,
}: {
  children: ReactNode
  active?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full [&_svg]:size-4.5',
        size.iconCircle,
        active ? 'bg-primary-surface text-primary-emphasis' : 'bg-surface-muted text-fg-tertiary',
      )}
    >
      {children}
    </span>
  )
}

export type Tone = 'draft' | 'open' | 'paused' | 'ended'

// 상태 글(builder-data text.status) → 색 갈래. 색만으로 말하지 않게 알약에 글이 늘 함께 있다.
export function toneOf(status: string): Tone {
  if (status === '활성') return 'open'
  if (status === '잠시 멈춤') return 'paused'
  if (status === '종료') return 'ended'
  return 'draft'
}

export const BAND: Record<Tone, string> = {
  draft: 'bg-fg-subtle',
  open: 'bg-success-emphasis',
  paused: 'bg-warning-mark',
  ended: 'bg-fg-faint',
}

const PILL: Record<Tone, string> = {
  draft: 'bg-surface-muted text-fg-secondary',
  open: 'bg-success-surface text-success',
  paused: 'bg-warning-surface text-warning',
  ended: 'bg-surface-muted text-fg-tertiary',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center px-2.5 py-0.5 font-semibold',
        type.small,
        radius.pill,
        PILL[toneOf(status)],
      )}
    >
      {status}
    </span>
  )
}

// 접힌 카드 오른쪽: 다 찼으면 초록 체크, 남았으면 '채울 칸 n' 알약(편집기 1순위)
export function FillMark({ missing }: { missing: number }) {
  if (missing === 0)
    return (
      <span className="grid size-5.5 shrink-0 place-items-center rounded-full bg-success-surface text-success">
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
        <span className="sr-only">다 채움</span>
      </span>
    )
  return (
    <span
      className={cn(
        'shrink-0 bg-primary-surface px-2.5 py-0.5 font-semibold text-primary-strong',
        type.small,
        radius.pill,
      )}
    >
      채울 칸 {missing}
    </span>
  )
}

// 잠김 한 줄(신청이 있어 받는 항목을 바꿀 수 없음, EVT-05B)
export function LockedLine({ children }: { children: ReactNode }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-fg-tertiary', type.small)}>
      <Lock aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}

// 켜기·끄기 줄. 줄 전체가 label이라 휴대폰에서 44px 줄 전체를 누른다. 잠긴 줄은 자물쇠와 '늘 받음'.
export function SwitchRow({
  label,
  checked,
  locked,
  onChange,
}: {
  label: string
  checked: boolean
  locked?: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 items-center justify-between gap-3',
        locked ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <span className={cn('flex items-center gap-2 text-fg-body', type.body)}>
        {label}
        {locked && <Lock aria-label="바꿀 수 없음" className="size-3.5 text-fg-subtle" />}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={locked}
        onChange={event => onChange?.(event.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
          checked ? (locked ? 'bg-primary-soft' : 'bg-primary-emphasis') : 'bg-muted-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-all',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
    </label>
  )
}

// 휴대폰 틀: 흰 화면 + 가는 테두리 + 위쪽 작은 막대. 안은 스크롤된다.
export function PhoneFrame({
  children,
  scrollRef,
  className,
}: {
  children: ReactNode
  scrollRef?: React.Ref<HTMLDivElement>
  className?: string
}) {
  return (
    <div
      className={cn(
        'border border-border-default bg-white p-1.5',
        radius.phone,
        shadow.phone,
        className,
      )}
    >
      <div className="flex justify-center pt-1 pb-2" aria-hidden>
        <span className="h-1.5 w-14 rounded-full bg-muted-strong" />
      </div>
      <div
        ref={scrollRef}
        className={cn('overflow-y-auto overscroll-contain', radius.phoneScreen, size.phoneScreen)}
      >
        {children}
      </div>
    </div>
  )
}

// 복사 같은 짧은 결과를 화면 아래 한 줄로 잠깐 알린다(Material snackbar). 확인 창은 쓰지 않는다.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const show = (text: string) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS)
  }
  const toast = message ? (
    <div
      role="status"
      className={cn(
        'fixed inset-x-4 bottom-6 z-50 mx-auto w-fit max-w-sm rounded-full bg-surface-inverse px-4 py-2.5 text-white shadow-lg',
        type.body,
      )}
    >
      {message}
    </div>
  ) : null
  return { show, toast }
}

// 줄을 짧게 흔들어 눈을 보낸다(꺼진 버튼 대신 누를 때 빠진 곳을 가리킨다). CSS 파일 없이 Web Animations로.
const SHAKE_MS = 360
const SHAKE_PX = 6
export function shake(element: Element | null) {
  if (!(element instanceof HTMLElement)) return
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  element.focus({ preventScroll: true })
  element.animate(
    [0, -SHAKE_PX, SHAKE_PX, -SHAKE_PX, SHAKE_PX, 0].map(x => ({
      transform: `translateX(${x}px)`,
    })),
    { duration: SHAKE_MS, easing: 'ease-in-out' },
  )
}
