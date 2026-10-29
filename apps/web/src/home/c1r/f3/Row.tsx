import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { reasonOf } from './reasons'
import { ROW_ICON, ROW_PAD_X, TEXT_MAIN, TEXT_SUB } from './tokens'

type Actions = Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>

const WRAP = 'break-keep wrap-anywhere'
// 둘째 줄의 글 링크: 줄 덮개 위로 올리고(z-10), 390에서 누르는 자리만 44px로 키운다.
const SUB_LINK = cn(
  'relative z-10 h-auto gap-1 p-0 font-medium [&_svg]:size-3.5',
  TEXT_SUB,
  headLinkTouch,
)

// 줄 앞 아이콘 원: 띠의 알약과 같은 그림·같은 짙기(지남·오늘은 짙은 면).
function RowIcon({ row }: { row: C1rRow }) {
  const reason = reasonOf(row)
  const Icon = reason.icon
  return (
    <span
      aria-hidden
      className={cn(
        'mt-3.5 flex shrink-0 items-center justify-center self-start rounded-full',
        ROW_ICON,
        reason.urgent ? 'bg-fg text-white' : 'border border-border bg-card text-fg-secondary',
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} />
    </span>
  )
}

// 둘째 줄: 사실 → 누구에게(묻기) → 물어본 상태(그 대화) 또는 행사. 가운뎃점 대신 간격으로 나눈다
// (물어본 상태 꼴 안의 점 하나만 남는다).
function Meta({ row, onAsk, onOpenAsked, onAssign }: { row: C1rRow } & Omit<Actions, 'onOpen'>) {
  return (
    <div className={cn('mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', TEXT_SUB)}>
      <span
        className={cn('shrink-0 font-semibold', row.danger ? 'text-danger' : 'text-fg-secondary')}
      >
        {row.fact}
      </span>
      {row.person ? (
        <Button
          variant="link"
          touch={false}
          className={cn(SUB_LINK, 'text-primary-strong')}
          aria-label={`${row.contact}에게 묻기`}
          onClick={() => onAsk(row)}
        >
          <MessageCircle aria-hidden />
          {row.contact}
        </Button>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-fg-tertiary">{row.contact}</span>
          <Button
            variant="link"
            touch={false}
            className={cn(SUB_LINK, 'text-primary-strong')}
            onClick={() => onAssign(row)}
          >
            배정하기
          </Button>
        </span>
      )}
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn(
            SUB_LINK,
            'font-normal text-fg-tertiary underline decoration-input underline-offset-3',
          )}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && <span className="min-w-0 flex-1 truncate text-fg-muted">{row.event}</span>
      )}
    </div>
  )
}

// 줄: 상자 없이 바닥 위에 흐른다. 아이콘 원 뒤에서 시작하는 가는 선으로만 나눈다(Flighty 안내 줄).
// 줄 전체가 일 보기(미배정 구성원 줄은 배정하기)다.
// index: 맨 위 줄은 선을 긋지 않는다. 716·977은 두 열이라 둘째 줄도 맨 위다.
export function Row({ row, index, ...actions }: { row: C1rRow; index: number } & Actions) {
  const { onOpen, onAsk, onOpenAsked, onAssign } = actions
  const open = row.kind === 'unassigned' ? onAssign : onOpen
  return (
    <li className={cn('group flex gap-3', ROW_PAD_X, rowLinkBox, 'rounded-2xl')}>
      <RowIcon row={row} />
      <div
        className={cn(
          'min-w-0 flex-1 border-t border-border py-3',
          index === 0 && 'border-t-0',
          index === 1 && '@2xl:border-t-0',
        )}
      >
        <Button
          variant="link"
          touch={false}
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left font-semibold whitespace-normal text-fg hover:no-underline group-hover:underline',
            TEXT_MAIN,
            rowLinkTarget,
          )}
          onClick={() => open(row)}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </Button>
        <Meta row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} onAssign={onAssign} />
      </div>
    </li>
  )
}
