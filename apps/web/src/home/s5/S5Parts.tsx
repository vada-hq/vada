import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'

// S5 흑백 시안의 글자 단계(notes/home-design-rules.md 1.1). 이 일곱 조합 말고는 쓰지 않는다.
export const H1 = 'text-base font-semibold text-gray-900'
export const R = 'text-sm font-medium text-gray-900'
export const RP = 'text-sm font-semibold text-gray-900'
export const M = 'text-xs text-gray-500'
export const MP = 'text-xs font-semibold text-gray-900'
// 흑백의 링크(L): 진한 글자 + 밑줄. S8에서 blue-700, 밑줄 없음으로 바꾼다.
const L = 'h-auto gap-1 p-0 text-xs font-medium text-gray-900 underline'
// 긴 글은 자르지 않고 어절로 접는다(1.8).
export const WRAP = 'break-keep wrap-anywhere'

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button variant="link" className={cn(L, 'max-sm:min-h-11')} onClick={onClick}>
      {children}
    </Button>
  )
}

// 줄 제목: 줄 전체를 누르는 자리로 만든다(row-link).
export function RowTitle({
  children,
  strong = false,
  onClick,
}: {
  children: ReactNode
  strong?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="link"
      className={cn(
        'h-auto max-w-full justify-start gap-1 p-0 text-left whitespace-normal',
        strong ? RP : R,
        WRAP,
        rowLinkTarget,
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function SectionHead({ id, title, right }: { id: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className={cn(H1, WRAP)}>
        {title}
      </h2>
      {right}
    </div>
  )
}

// 상자 없는 구역: 머리글 + 8px + 줄(1.4, 1.5)
export function Section({
  id,
  title,
  right,
  className,
  children,
}: {
  id: string
  title: string
  right?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-2', className)}>
      <SectionHead id={id} title={title} right={right} />
      {children}
    </section>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className={cn(M, 'py-3')}>{children}</p>
)

export const rowClass = cn(rowLinkBox, 'py-3')

// 제목 + (주목 글자, 메타) 한 줄. 주목(M+)을 앞에 둔다(① 좁은 줄과 같은 차례).
export function ListRow({
  title,
  note,
  meta,
  onOpen,
}: {
  title: string
  note: string | null
  meta: string | null
  onOpen: () => void
}) {
  return (
    <li className={cn(rowClass, 'flex flex-col gap-1')}>
      <RowTitle onClick={onOpen}>{title}</RowTitle>
      {(note || meta) && (
        <p className="flex flex-wrap gap-x-2">
          {note && <span className={cn(MP, WRAP)}>{note}</span>}
          {meta && <span className={cn(M, WRAP)}>{meta}</span>}
        </p>
      )}
    </li>
  )
}

export const listClass = 'flex flex-col divide-y divide-gray-200'
