import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Avatar } from './Avatar'
import { AVATAR_MD, ROW_RADIUS } from './tokens'

// 초점 카드 옆(358은 아래)의 조용한 줄. 테두리·구분선 없이 간격만으로 나누고, 누를 때만 옅은 면이 깔린다.
// 왼쪽 머리글자 원 = 누구, 첫 줄 = 일 제목 + 오른쪽 끝 사실(칩 없이 글자, 지남·오늘만 위험 색),
// 둘째 줄 = 연락할 사람 이름(누르면 묻기) + 물어본 상태(누르면 그 대화) 또는 행사.
// 줄 전체를 누르면 일 보기(배정 줄은 배정하기). 행동은 늘 보이는 글자라 터치에도 hover가 필요 없다.

const WRAP = 'break-keep wrap-anywhere'
const INLINE_LINK = cn('relative z-10 h-auto p-0 text-xs', headLinkTouch)

function Second({
  row,
  onAsk,
  onOpenAsked,
}: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onOpenAsked'>) {
  return (
    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-fg-muted">
      {row.person ? (
        <Button
          variant="link"
          touch={false}
          className={cn(INLINE_LINK, 'font-medium')}
          aria-label={`${row.contact}에게 묻기`}
          onClick={() => onAsk(row)}
        >
          {row.contact}
        </Button>
      ) : (
        <span>{row.contact}</span>
      )}
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn(INLINE_LINK, 'font-normal text-fg-tertiary underline')}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && (
          <span className="flex min-w-0 flex-1 gap-x-2">
            <span aria-hidden>·</span>
            <span className="truncate">{row.event}</span>
          </span>
        )
      )}
    </p>
  )
}

type Props = { row: C1rRow } & Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>

export function QuietRow({ row, onOpen, onAsk, onOpenAsked, onAssign }: Props) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 hover:bg-surface-subtle',
        ROW_RADIUS,
        rowLinkBox,
      )}
    >
      <Avatar row={row} size={AVATAR_MD} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <Button
            variant="link"
            touch={false}
            className={cn(
              'h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg hover:no-underline',
              rowLinkTarget,
            )}
            onClick={() => (row.person ? onOpen(row) : onAssign(row))}
          >
            <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
          </Button>
          <span
            className={cn(
              'shrink-0 text-sm font-semibold whitespace-nowrap',
              row.danger ? 'text-danger' : 'text-fg-secondary',
            )}
          >
            {row.fact}
          </span>
        </div>
        <Second row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} />
      </div>
    </li>
  )
}
