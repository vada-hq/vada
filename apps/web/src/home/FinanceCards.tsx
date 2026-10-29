import { ChevronRight, Clock, FileText, CircleAlert } from 'lucide-react'
import { KOREAN_DATE_LENGTH, dateFromKorean, type HomeFinanceBoard } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { dueText, endedLabel } from '../events/event-header-view'
import { neededMarkOf } from '../finance/purchase-view'
import HomeCard from './HomeCard'
import { HOME_PLANS } from './home-kinds'
import HomeRow from './HomeRow'
import { remainingTidyLabel } from './council-view'

const [PENDING, NEARBY, EXCEPTIONS] = HOME_PLANS.finance.cards
const chevron = <ChevronRight aria-hidden className="size-4 text-fg-subtle" />

export function PendingCard({
  pending,
  asOf,
  onOpen,
  onSeeAll,
}: {
  pending: HomeFinanceBoard['pending']
  asOf: string
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  const rows = pending.requests.map(request => {
    const mark = neededMarkOf(request.neededBy, dateFromKorean(asOf))
    return (
      <HomeRow
        key={request.id}
        card
        title={request.title}
        meta={[
          request.event?.name,
          request.requestedBy.name,
          request.neededBy ? `필요한 때 ${dueText(request.neededBy)}` : '필요한 때 없음',
        ]}
        side={
          <>
            {mark && (
              <Badge tone={mark === 'soon' ? 'warning' : 'danger'}>
                {mark === 'soon' ? '임박' : '지남'}
              </Badge>
            )}
            {chevron}
          </>
        }
        onOpen={() => onOpen(request.id)}
      />
    )
  })
  return (
    <HomeCard
      title={PENDING}
      icon={FileText}
      read={{ kind: 'ready', total: pending.total, rows }}
      empty="결재 대기 없음"
      onSeeAll={onSeeAll}
    />
  )
}

export function NearbyCard({
  nearby,
  onOpen,
  onSeeAll,
}: {
  nearby: HomeFinanceBoard['nearby']
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  const rows = nearby.items.map(item => (
    <HomeRow
      key={item.id}
      card
      title={item.name}
      meta={[item.event?.name, `필요한 때 ${dueText(item.neededBy)}`]}
      side={chevron}
      onOpen={() => onOpen(item.requestId)}
    />
  ))
  return (
    <HomeCard
      title={NEARBY}
      icon={Clock}
      read={{ kind: 'ready', total: nearby.total, rows }}
      empty="필요한 때 가까운 품목 없음"
      onSeeAll={onSeeAll}
    />
  )
}

export function ExceptionsCard({
  settling,
  ownedEnded,
  onOpen,
  onSeeAll,
}: {
  settling: HomeFinanceBoard['settling']
  ownedEnded: HomeFinanceBoard['ownedEnded']
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  const rows = settling.events.map(row => {
    const end = row.event.endsAt ?? row.event.startsAt
    const owned = ownedEnded.find(item => item.event.id === row.event.id)
    return (
      <HomeRow
        key={row.event.id}
        card
        title={row.event.name}
        meta={[
          end && `${dueText(end.slice(0, KOREAN_DATE_LENGTH))} 종료`,
          endedLabel(row.endedDays),
        ]}
        sub={
          owned
            ? remainingTidyLabel(owned.remaining)
            : row.settlement.remaining === 0
              ? '완료 가능'
              : `정산 남은 것 ${row.settlement.remaining}`
        }
        side={chevron}
        onOpen={() => onOpen(row.event.id)}
      />
    )
  })
  return (
    <HomeCard
      title={EXCEPTIONS}
      icon={CircleAlert}
      read={{ kind: 'ready', total: settling.total, rows }}
      empty="예외·대기 없음"
      onSeeAll={onSeeAll}
    />
  )
}
