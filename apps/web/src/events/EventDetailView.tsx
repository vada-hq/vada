import { useState, type ReactNode } from 'react'
import type { CouncilView, EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { EVENT_COMPLETED_NOTICE, EVENT_LOAD_FAILED } from '@/lib/messages'
import { RegistrationTab } from '../registrations/RegistrationTab'
import TasksPage from '../tasks/TasksPage'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE } from './event-view'
import { EventMoneyTab } from './EventMoneyTab'
import { EventOverview } from './EventOverview'
import type { EventDialogHandlers } from './useEventSubmit'
import { useEventDetail } from './useEventDetail'

type Tab = 'overview' | 'tasks' | 'registrations' | 'money'
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'overview', label: '개요' },
  { tab: 'tasks', label: '업무' },
  { tab: 'registrations', label: '참가 신청' },
  { tab: 'money', label: '돈' },
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

// 행사 하나: 이름과 상태, 탭 셋(개요, 업무, 참가 신청). 업무 탭은 업무 화면을 그 행사로 좁혀 보인다.
export default function EventDetailView({ view, eventId, onBack, ...props }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const detail = useEventDetail(view.council.id, eventId, {
    onLost: props.onLost,
    onForbidden: props.onForbidden,
  })
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
      {event?.status === 'completed' && <Alert tone="info">{EVENT_COMPLETED_NOTICE}</Alert>}
      <EventTabs tab={tab} onTab={setTab} />
      <EventPanel tab={tab} view={view} eventId={eventId} detail={detail} {...props} />
    </div>
  )
}

type PanelProps = Omit<Props, 'onBack'> & {
  tab: Tab
  detail: ReturnType<typeof useEventDetail>
}

// 탭 하나의 내용. 개요, 업무, 참가 신청, 돈.
function EventPanel({ tab, view, eventId, detail, ...props }: PanelProps) {
  const handlers = { onLost: props.onLost, onForbidden: props.onForbidden }
  return (
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
      ) : tab === 'registrations' ? (
        <RegistrationTab view={view} eventId={eventId} {...handlers} />
      ) : tab === 'money' ? (
        <Loaded detail={detail}>
          {loaded => (
            <EventMoneyTab
              view={view}
              event={loaded}
              onEventChanged={next => {
                detail.replace(next)
                props.onChanged()
              }}
              reloadEvent={detail.reload}
              {...handlers}
            />
          )}
        </Loaded>
      ) : (
        <Overview
          councilId={view.council.id}
          detail={detail}
          handlers={handlers}
          onChanged={props.onChanged}
        />
      )}
    </div>
  )
}

// 행사를 읽는 동안과 읽지 못했을 때의 자리. 읽으면 탭 내용을 그린다.
function Loaded({
  detail,
  children,
}: {
  detail: ReturnType<typeof useEventDetail>
  children: (event: EventDetail) => ReactNode
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
  return children(state.data.event)
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
  return (
    <Loaded detail={detail}>
      {event => (
        <EventOverview
          councilId={councilId}
          event={event}
          {...handlers}
          onChanged={next => {
            detail.replace(next)
            onChanged()
          }}
        />
      )}
    </Loaded>
  )
}
