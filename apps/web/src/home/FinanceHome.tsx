import type { ReactNode } from 'react'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { HOME_CARD_ROWS, type HomeFinanceBoard, type HomeResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { openMenu, openMessageRoom, openRecord } from '@/lib/go-to'
import { rememberDepartment } from '@/lib/menu-memory'
import type { RoomListState } from '../chat/useRoomList'
import { myTasksLabel, remainingTidyLabel } from './council-view'
import { PendingCard, NearbyCard, ExceptionsCard } from './FinanceCards'
import FinanceBudgets from './FinanceBudgets'
import HomeFeaturedEvents from './HomeFeaturedEvents'
import HomeFrame from './HomeFrame'
import HomeGreeting, { HomeShortcut } from './HomeGreeting'
import { GridLayout } from './HomeLayout'
import { inboxRooms } from './home-view'
import MessageInbox from './MessageInbox'

type Props = {
  home: HomeResponse
  board: HomeFinanceBoard
  councilId: string
  name: string
  rooms: RoomListState
  pushBand?: ReactNode
}

function Conditions({ board, councilId }: Pick<Props, 'board' | 'councilId'>) {
  // 예외 카드에 이미 보이는 책임 행사는 거기에 남은 업무까지 붙이고 반복하지 않는다(DEC-95 겹침 금지).
  const shown = new Set(board.settling.events.slice(0, HOME_CARD_ROWS).map(row => row.event.id))
  const rows = [
    ...board.departments.map(row => ({
      id: row.id,
      label: `${row.name} · 부서 업무 지남 ${row.overdue} · 담당자 없음 ${row.unassigned}`,
      onOpen: () => {
        rememberDepartment(row.id, row.name)
        openMenu('tasks', councilId, { tab: 'council', events: 'include', dept: row.id })
      },
    })),
    ...board.ownedEnded
      .filter(row => !shown.has(row.event.id))
      .map(row => ({
        id: row.event.id,
        label: `${row.event.name} · 후속 정리 중 · ${remainingTidyLabel(row.remaining)}`,
        onOpen: () => openRecord('events', councilId, row.event.id, { tab: 'money' }),
      })),
  ]
  if (rows.length === 0) return null
  return (
    <div className={`${cardClass} divide-y bg-surface-subtle`}>
      {rows.map(row => (
        <Button
          key={row.id}
          variant="ghost"
          className="h-auto w-full justify-start px-5 py-3 text-left text-xs font-normal break-keep whitespace-normal max-sm:min-h-11"
          onClick={row.onOpen}
        >
          <span className="min-w-0 flex-1 wrap-anywhere">{row.label}</span>
          <ChevronRight aria-hidden className="shrink-0 text-fg-subtle" />
        </Button>
      ))}
    </div>
  )
}

// HOME-01F: 인사·타일·바로가기 → 2×2 → 겸직 조건부 줄. 홈에서 처리하지 않고 원래 기록을 연다(DEC-95).
export default function FinanceHome({ home, board, councilId, name, rooms, pushBand }: Props) {
  const openRequest = (id: string) => openRecord('purchases', councilId, id)
  const openEvent = (id: string) => openRecord('events', councilId, id, { tab: 'money' })
  return (
    <HomeFrame
      pushBand={pushBand}
      greeting={
        <HomeGreeting
          today={home.today}
          name={name}
          inbox={
            <MessageInbox
              inCard
              rooms={rooms.kind === 'ready' ? inboxRooms(rooms.data.rooms) : []}
              onOpenRoom={(id, eventId) => openMessageRoom(councilId, id, eventId)}
              onSeeAll={() => openMenu('chat', councilId)}
            />
          }
          featured={
            <HomeFeaturedEvents home={home} onOpen={id => openRecord('events', councilId, id)} />
          }
          shortcuts={
            <HomeShortcut
              icon={ClipboardList}
              label={myTasksLabel(home.myTasks)}
              onOpen={() => openMenu('tasks', councilId, { tab: 'mine' })}
            />
          }
        />
      }
    >
      <GridLayout
        cards={[
          <PendingCard
            key="pending"
            pending={board.pending}
            asOf={home.asOf}
            onOpen={openRequest}
            onSeeAll={() => openMenu('purchases', councilId, { view: 'pending' })}
          />,
          <NearbyCard
            key="nearby"
            nearby={board.nearby}
            onOpen={openRequest}
            onSeeAll={() => openMenu('purchases', councilId, { view: 'all' })}
          />,
          <ExceptionsCard
            key="exceptions"
            settling={board.settling}
            ownedEnded={board.ownedEnded}
            onOpen={openEvent}
            onSeeAll={() => openMenu('finance', councilId, { tab: 'closing' })}
          />,
          <FinanceBudgets
            key="budgets"
            budgets={board.budgets}
            onOpen={openEvent}
            onSeeAll={() => openMenu('finance', councilId)}
          />,
        ]}
        below={<Conditions board={board} councilId={councilId} />}
      />
    </HomeFrame>
  )
}
