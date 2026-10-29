import type { ReactNode } from 'react'
import { ChevronDown, Lock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FillMark, IconCircle, Sheet } from './parts'
import { radius, shadow, size, space, type } from './tokens'

// 편집기 카드 한 장. 접히면 한 줄 요약(제목 · 요약 · 채울 칸), 펼치면 왼쪽 강조색 세로 줄(b01)과 칸들.
// 머리 줄 전체가 누르는 곳이다(휴대폰 60px 줄).
export function FoldCard({
  icon,
  title,
  summary,
  missing,
  open,
  locked = false,
  onToggle,
  toolbar,
  children,
}: {
  icon: ReactNode
  title: string
  summary: string
  missing: number
  open: boolean
  locked?: boolean
  onToggle: () => void
  toolbar?: ReactNode
  children?: ReactNode
}) {
  return (
    <Sheet raised={open}>
      {open && (
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 rounded-l-xl bg-primary-emphasis', size.accent)}
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-xl py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          size.foldRow,
          space.cardX,
        )}
      >
        <IconCircle active={open}>{icon}</IconCircle>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('font-semibold text-fg wrap-anywhere', type.body)}>{title}</span>
          {!open && summary && (
            <span className={cn('truncate text-fg-muted', type.small)}>{summary}</span>
          )}
        </span>
        {!locked && <FillMark missing={missing} />}
        {locked ? (
          <Lock aria-label="잠김" className="size-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-fg-subtle transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </button>
      {open && children && (
        <div className={cn('flex flex-col pb-5', space.fields, space.cardX)}>{children}</div>
      )}
      {toolbar}
    </Sheet>
  )
}

// 펼친 카드 오른쪽 바깥에 떠 있는 세로 도구 막대(구글폼 b01). 1024px 이상에서만, 그 아래는 단 맨 아래 꽉 찬 줄.
export function FloatingToolbar({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className={cn(
        'absolute top-0 left-full ml-1 hidden flex-col items-center border border-border-subtle bg-white py-1.5 lg:flex',
        radius.pill,
        shadow.raised,
        size.toolbar,
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        className="flex cursor-pointer flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-fg-secondary outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-5" />
        <span className={type.small}>질문</span>
      </button>
    </div>
  )
}

// 1024px 미만: 단 맨 아래 꽉 찬 [+ 질문] 줄
export function AddQuestionRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'flex min-h-12 w-full cursor-pointer items-center justify-center gap-1.5 border-2 border-dashed border-border-strong bg-white font-medium text-fg-secondary outline-none hover:border-border-strong-hover focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden',
        radius.card,
        type.body,
      )}
    >
      <Plus aria-hidden className="size-4" />
      질문
    </button>
  )
}
