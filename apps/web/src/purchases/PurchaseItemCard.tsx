import { ChevronRight, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { wonLabel } from '@/finance/purchase-view'
import { dayLabel } from '@/lib/korean-date-text'
import { cn } from '@/lib/utils'
import { cardAmountOf, cardChipOf, type BoardCard } from './purchase-board'

type Props = {
  stack: BoardCard[]
  // 행사 안에서는 행사 이름을 빼고 요청 제목만 둔다.
  showEvent: boolean
  onOpen: (requestId: string) => void
}

// 품목 카드(와이어프레임 PUR-00 03). 같은 요청의 품목이 같은 열에 여럿이면 맨 앞 카드 뒤로 겹쳐 보이고 오른쪽 위에 수를 단다.
// 카드를 누르면 그 구매 요청이 열린다.
export function PurchaseItemCard({ stack, showEvent, onOpen }: Props) {
  const [card] = stack
  if (!card) return null
  const { item, request } = card
  const chip = cardChipOf(card)
  const amount = cardAmountOf(item)
  return (
    <div className="relative">
      {stack.length > 1 && <StackShadow />}
      <article className={cn(cardClass, rowLinkBox, 'flex flex-col gap-3 p-3 break-keep')}>
        <CardHead card={card} />
        <div className="flex min-w-0 flex-col gap-1">
          <ItemName card={card} onOpen={onOpen} />
          <RequestLine card={card} showEvent={showEvent} />
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Fact label="수량">{`${item.quantity}개`}</Fact>
          <Fact label={item.amount === null ? '예상 금액' : '승인 금액'}>
            {amount === null ? '미정' : wonLabel(amount)}
          </Fact>
        </dl>
        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
          <Badge tone={chip.tone}>{chip.label}</Badge>
          <span className="text-xs text-fg-muted tabular-nums">{dayLabel(request.createdAt)}</span>
        </div>
      </article>
      {stack.length > 1 && <StackCount count={stack.length} />}
    </div>
  )
}

function ItemName({ card, onOpen }: { card: BoardCard; onOpen: Props['onOpen'] }) {
  return (
    <h3 className="min-w-0">
      <Button
        variant="link"
        className={cn(
          rowLinkTarget,
          'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg wrap-anywhere no-underline hover:no-underline',
        )}
        onClick={() => onOpen(card.request.id)}
      >
        {card.item.name}
      </Button>
    </h3>
  )
}

function CardHead({ card }: { card: BoardCard }) {
  const department = card.request.requesterDepartments?.[0]
  return (
    <div className="flex items-center justify-between gap-2">
      {department ? <Badge>{department}</Badge> : <span />}
      {card.request.neededBy && (
        <span className="text-xs text-fg-muted tabular-nums">
          {dayLabel(card.request.neededBy)}
        </span>
      )}
    </div>
  )
}

function RequestLine({ card, showEvent }: { card: BoardCard; showEvent: boolean }) {
  const eventName = showEvent ? (card.request.event?.name ?? '상시') : null
  return (
    <p className="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
      {eventName && <span className="shrink-0 font-medium text-fg-secondary">{eventName} ·</span>}
      <Package aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate text-primary-strong">{card.request.title}</span>
    </p>
  )
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-sm font-semibold text-fg tabular-nums">{children}</dd>
    </div>
  )
}

// 겹친 카드: 맨 앞 카드 아래로 두 장이 비켜 보인다.
function StackShadow() {
  return (
    <>
      <div aria-hidden className={cn(cardClass, 'absolute inset-x-2 -bottom-2 h-6')} />
      <div aria-hidden className={cn(cardClass, 'absolute inset-x-1 -bottom-1 h-6')} />
    </>
  )
}

function StackCount({ count }: { count: number }) {
  return (
    <span
      aria-label={`같은 요청 품목 ${count}개`}
      className="absolute -top-2 -right-2 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground"
    >
      <Package aria-hidden className="size-3" />
      {count}
    </span>
  )
}

// 처리 단계 보드의 작은 카드: 부서·필요한 날짜, 품목, 요청, 상태와 [상세보기]. 카드 어디를 눌러도 그 요청이 열린다.
export function ProcessItemCard({ stack, onOpen }: Omit<Props, 'showEvent'>) {
  const [card] = stack
  if (!card) return null
  const chip = cardChipOf(card)
  return (
    <div className="relative">
      {stack.length > 1 && <StackShadow />}
      <article className={cn(cardClass, rowLinkBox, 'flex flex-col gap-2 p-3 break-keep')}>
        <CardHead card={card} />
        <ItemName card={card} onOpen={onOpen} />
        <RequestLine card={card} showEvent={false} />
        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
          <Badge tone={chip.tone}>{chip.label}</Badge>
          <Button
            variant="outline"
            size="sm"
            className="relative z-10"
            aria-label={`${card.item.name} 상세보기`}
            onClick={() => onOpen(card.request.id)}
          >
            상세보기
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </article>
      {stack.length > 1 && <StackCount count={stack.length} />}
    </div>
  )
}
