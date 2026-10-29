import { Check, ChevronRight, CircleAlert } from 'lucide-react'
import type { HomeCouncilBoard } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import EventStatusChip from '../events/EventStatusChip'
import { ATTENTION_CHIP, attentionParts, followUpParts, remainingTidyLabel } from './council-view'
import HomeCard from './HomeCard'
import HomeChip from './HomeChip'
import { HOME_PLANS } from './home-kinds'
import { COLUMN_HEAD } from './HomeLayout'
import HomeRow from './HomeRow'

const [ATTENTION, FOLLOW_UP] = HOME_PLANS.council.columns

// 회장단 '확인이 필요한 운영 상황'(3열 왼쪽): 학생회 업무의 지남 → 담당자 없음, 아래 '미배정 구성원' 조건부 줄(0이면 없음, DEC-87).
// 전체 보기는 지금 업무 화면의 학생회 전체 보기다(칩 줄이 생기면 그 칩으로, 명세 027 조각 12).
export function AttentionCard({
  board,
  onOpenTask,
  onSeeAll,
  onSeePeople,
  onSeeFinance,
}: {
  board: Pick<HomeCouncilBoard, 'attention' | 'unassignedMembers' | 'financeStaffed'>
  onOpenTask: (taskId: string) => void
  onSeeAll: () => void
  onSeePeople: () => void
  onSeeFinance: () => void
}) {
  const { attention, unassignedMembers } = board
  const rows = attention.items.map(item => (
    <HomeRow
      key={item.task.id}
      card
      title={item.task.title}
      meta={attentionParts(item)}
      side={<HomeChip label={ATTENTION_CHIP[item.reason]} />}
      onOpen={() => onOpenTask(item.task.id)}
    />
  ))
  return (
    <HomeCard
      title={ATTENTION}
      icon={CircleAlert}
      read={{ kind: 'ready', total: attention.total, rows }}
      empty="확인할 일 없음"
      onSeeAll={onSeeAll}
      headClassName={COLUMN_HEAD}
      footnote={
        unassignedMembers > 0
          ? { label: '미배정 구성원', text: `${unassignedMembers}명`, onOpen: onSeePeople }
          : null
      }
      footer={
        board.financeStaffed === false && (
          <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-surface-subtle px-5 text-xs break-keep text-fg-muted">
            <span>재정 담당 · 없음</span>
            <Button variant="link" className="min-h-11 px-0 text-xs" onClick={onSeeFinance}>
              조직에서 정하기
            </Button>
          </div>
        )
      }
    />
  )
}

// 회장단 '후속 정리 중인 행사'(3열 가운데): 끝났고 완료하지 않은 행사, 끝난 지 오래된 것부터(재정 '행사 정산' 탭과 같은 차례).
// 정산이 남은 행사는 행사 '재정' 탭으로 연다(DEC-95). 전체 보기는 같은 셈·차례의 재정 '행사 정산' 탭이다(정한 것 6).
export function FollowUpCard({
  followUp,
  onOpenEvent,
  onSeeAll,
}: {
  followUp: HomeCouncilBoard['followUp']
  onOpenEvent: (eventId: string, tab?: 'money') => void
  onSeeAll: () => void
}) {
  const rows = followUp.events.map(row => (
    <HomeRow
      key={row.event.id}
      card
      chip={<EventStatusChip status={row.event.status} />}
      title={row.event.name}
      meta={followUpParts(row)}
      sub={remainingTidyLabel(row.remaining)}
      side={<ChevronRight aria-hidden className="size-4 text-fg-subtle" />}
      onOpen={() =>
        row.remaining.settlement > 0
          ? onOpenEvent(row.event.id, 'money')
          : onOpenEvent(row.event.id)
      }
    />
  ))
  return (
    <HomeCard
      title={FOLLOW_UP}
      icon={Check}
      unit="개"
      read={{ kind: 'ready', total: followUp.total, rows }}
      empty="후속 정리 중인 행사 없음"
      onSeeAll={onSeeAll}
      headClassName={COLUMN_HEAD}
    />
  )
}
