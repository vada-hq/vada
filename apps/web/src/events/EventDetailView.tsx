import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { EVENT_LOAD_FAILED } from '@/lib/messages'
import TasksPage from '../tasks/TasksPage'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE } from './event-view'
import { EventOverview } from './EventOverview'
import type { EventDialogHandlers } from './useEventSubmit'
import { useEventDetail } from './useEventDetail'

type Tab = 'overview' | 'tasks'
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'overview', label: '개요' },
  { tab: 'tasks', label: '업무' },
]

type Props = EventDialogHandlers & {
  view: CouncilView
  eventId: string
  onBack: () => void
  // 내 변경이 목록에 닿았다(행사 목록을 다시 읽는다).
  onChanged: () => void
  // 행사의 업무가 바뀌었다(옆 메뉴의 업무 수를 다시 읽는다).
  onTasksChanged: () => void
}

function EventTabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <div role="tablist" aria-label="행사 보기" className="flex border-b">
      {TABS.map(item => (
        <TabButton key={item.tab} aria-selected={tab === item.tab} onClick={() => onTab(item.tab)}>
          {item.label}
        </TabButton>
      ))}
    </div>
  )
}

// 행사 하나: 이름과 상태, 탭 둘(개요, 업무). 업무 탭은 업무 화면을 그 행사로 좁혀 보인다.
export default function EventDetailView({ view, eventId, onBack, ...props }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const handlers = { onLost: props.onLost, onForbidden: props.onForbidden }
  const detail = useEventDetail(view.council.id, eventId, handlers)
  const event = detail.state.kind === 'ready' ? detail.state.data.event : null
  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" size="sm" className="self-start" onClick={onBack}>
        행사 목록
      </Button>
      {event && (
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-base font-semibold text-gray-900 wrap-anywhere">
            {event.name}
          </h2>
          <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
        </div>
      )}
      <EventTabs tab={tab} onTab={setTab} />
      <div role="tabpanel" className="flex flex-col gap-3">
        {tab === 'tasks' ? (
          <TasksPage
            view={view}
            eventId={eventId}
            onForbidden={props.onForbidden}
            onChanged={() => {
              props.onTasksChanged()
              void detail.reload()
            }}
          />
        ) : (
          <Overview
            councilId={view.council.id}
            detail={detail}
            handlers={handlers}
            onChanged={props.onChanged}
          />
        )}
      </div>
    </div>
  )
}

function Overview({
  councilId,
  detail,
  handlers,
  onChanged,
}: {
  councilId: string
  detail: ReturnType<typeof useEventDetail>
  handlers: EventDialogHandlers
  onChanged: () => void
}) {
  const { state } = detail
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{EVENT_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void detail.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return (
    <EventOverview
      councilId={councilId}
      event={state.data.event}
      {...handlers}
      onChanged={next => {
        detail.replace(next)
        onChanged()
      }}
    />
  )
}
