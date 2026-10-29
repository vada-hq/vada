import { ChevronRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Avatar } from './Avatar'
import { AVATAR_LG, FACT_XL, FOCUS_PAD, FOCUS_RADIUS, PILL } from './tokens'

// 초점 카드: 가장 급한 1건(차례 맨 앞 = 가장 많이 지난 것)만 색 면을 깐 큰 카드로 올린다(카카오뱅크 대표 통장, 쿠팡이츠 큰 시간).
// 위에서부터 큰 사실(무엇이 얼마나 막혔나) → 일 제목 → 행사, 맨 아래에 사람(머리글자 원 + 이름·역할)과 흰 '묻기' 알약 하나
// (Live Activity의 '무엇 + 누구'를 한 장에). 카드 전체를 누르면 일 보기, 알약만 묻기.
// 면 색은 지남·오늘이면 옅은 위험 면, 아니면 중립 면(K5: 위험 색은 지남·오늘 사실에만).
// solo: 다른 줄이 없을 때(첫날 등) 카드가 가로 전체를 쓰므로 넓은 폭에서는 사람·행동을 오른쪽으로 보내 여백이 한쪽에 몰리지 않게 한다.

const WRAP = 'break-keep wrap-anywhere'

type WhoProps = { row: C1rRow; solo: boolean } & Pick<C1rProps, 'onAsk' | 'onAssign'>

function Who({ row, solo, onAsk, onAssign }: WhoProps) {
  const assign = row.person === null
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', solo && '@2xl:gap-4')}>
      <Avatar row={row} size={AVATAR_LG} className={assign ? 'bg-card' : undefined} />
      <p className={cn('min-w-0 flex-1 leading-tight', solo && '@2xl:flex-none')}>
        <span className={cn('block text-sm font-semibold text-fg', WRAP)}>
          {row.person?.name ?? row.contact}
        </span>
        {row.person && (
          <span className={cn('block text-xs text-fg-tertiary', WRAP)}>{row.person.role}</span>
        )}
      </p>
      <Button
        variant="outline"
        className={cn(
          'relative z-10 gap-1 border-transparent bg-card text-sm font-semibold text-primary-strong shadow-none hover:bg-card hover:text-primary-strong',
          PILL,
        )}
        aria-label={assign ? `${row.title} 배정하기` : `${row.contact}에게 묻기`}
        onClick={() => (assign ? onAssign(row) : onAsk(row))}
      >
        {!assign && <MessageCircle />}
        {assign ? '배정하기' : '묻기'}
        <ChevronRight className="-mr-1 text-fg-muted" />
      </Button>
    </div>
  )
}

type Props = { row: C1rRow; solo: boolean } & Pick<
  C1rProps,
  'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'
>

export function FocusCard({ row, solo, onOpen, onAsk, onOpenAsked, onAssign }: Props) {
  const assign = row.person === null
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col gap-5 has-focus-visible:ring-2 has-focus-visible:ring-blue-700',
        FOCUS_RADIUS,
        FOCUS_PAD,
        row.danger ? 'bg-danger-surface' : 'bg-muted',
        solo && '@2xl:flex-row @2xl:items-end @2xl:justify-between',
      )}
    >
      <div className="min-w-0">
        <p className={cn('font-bold', FACT_XL, row.danger ? 'text-danger' : 'text-fg')}>
          {row.fact}
        </p>
        <h3 className="mt-1.5">
          <Button
            variant="link"
            touch={false}
            className={cn(
              'h-auto max-w-full justify-start p-0 text-left text-lg font-semibold whitespace-normal text-fg hover:no-underline',
              rowLinkTarget,
            )}
            onClick={() => (assign ? onAssign(row) : onOpen(row))}
          >
            <span className={cn('line-clamp-2', WRAP)}>{row.title}</span>
          </Button>
        </h3>
        {(row.event || row.askedText) && (
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-fg-tertiary">
            {row.event && <span className="truncate">{row.event}</span>}
            {row.askedText && (
              <Button
                variant="link"
                touch={false}
                className={cn(
                  'relative z-10 h-auto p-0 text-xs font-medium text-fg-secondary underline',
                  headLinkTouch,
                )}
                onClick={() => onOpenAsked(row)}
              >
                {row.askedText}
              </Button>
            )}
          </p>
        )}
      </div>
      <div className={cn('mt-auto', solo && '@2xl:mt-0')}>
        <Who row={row} solo={solo} onAsk={onAsk} onAssign={onAssign} />
      </div>
    </article>
  )
}
