import { ChevronRight, CircleAlert, Receipt } from 'lucide-react'
import type { HomeDepartmentBoard } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { dueText } from '../events/event-header-view'
import EventStatusChip from '../events/EventStatusChip'
import { STATUS_LABEL, STATUS_TONE } from '../finance/purchase-view'
import { ATTENTION_CHIP, remainingTidyLabel } from './council-view'
import HomeCard from './HomeCard'
import HomeChip from './HomeChip'
import HomeRow from './HomeRow'
import { HOME_PLANS } from './home-kinds'

const [, , PURCHASES, ATTENTION] = HOME_PLANS.department.cards

export function DepartmentPurchasesCard({
  purchases,
  memberId,
  onOpen,
  onSeeAll,
}: {
  purchases: HomeDepartmentBoard['purchases']
  memberId: string
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  return (
    <HomeCard
      title={PURCHASES}
      icon={Receipt}
      empty="부서 구매 없음"
      onSeeAll={onSeeAll}
      read={{
        kind: 'ready',
        total: purchases.total,
        rows: purchases.requests.map(row => (
          <HomeRow
            key={row.id}
            card
            title={row.title}
            meta={[
              row.requestedBy.id === memberId ? '내 요청' : `부서 요청 · ${row.requestedBy.name}`,
            ]}
            side={
              <>
                <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                <ChevronRight aria-hidden className="size-4 text-fg-subtle" />
              </>
            }
            onOpen={() => onOpen(row.id)}
          />
        )),
      }}
    />
  )
}

export function DepartmentAttentionCard({
  board,
  onOpenTask,
  onOpenEvent,
  onSeeAll,
  onCongestion,
}: {
  board: HomeDepartmentBoard
  onOpenTask: (id: string) => void
  onOpenEvent: (id: string, tab?: 'money') => void
  onSeeAll: () => void
  onCongestion: () => void
}) {
  const rows = board.attention.items.map(({ task, reason }) => (
    <HomeRow
      key={task.id}
      card
      title={task.title}
      meta={[
        board.departments.length > 1 ? (task.department?.name ?? null) : null,
        task.event?.name ?? null,
        task.dueDate ? `${dueText(task.dueDate)} 마감` : '마감 없음',
        task.assignee?.name ?? '담당자 없음',
      ]}
      side={<HomeChip label={ATTENTION_CHIP[reason]} />}
      onOpen={() => onOpenTask(task.id)}
    />
  ))
  const leadingRows = board.ownedEnded.map(row => (
    <HomeRow
      key={row.event.id}
      card
      title={row.event.name}
      chip={<EventStatusChip status={row.event.status} />}
      sub={remainingTidyLabel(row.remaining)}
      onOpen={() => onOpenEvent(row.event.id, row.remaining.settlement > 0 ? 'money' : undefined)}
    />
  ))
  const congestion = board.congestion
  return (
    <HomeCard
      title={ATTENTION}
      icon={CircleAlert}
      empty="확인할 일 없음"
      read={{ kind: 'ready', total: board.attention.total + board.ownedEnded.length, rows }}
      leadingRows={leadingRows}
      onSeeAll={onSeeAll}
      seeAllLabel="업무 전체 보기"
      footnote={
        congestion
          ? {
              label: '마감 몰림',
              text: `${congestion.member.name} · ${dueText(congestion.firstDue)}~${dueText(congestion.lastDue)} ${congestion.count}건`,
              onOpen: onCongestion,
            }
          : null
      }
    />
  )
}
