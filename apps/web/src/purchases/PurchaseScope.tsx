import { useState } from 'react'
import { isUuid, type EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { useEvents, type EventList } from '@/events/useEvents'

type Props = {
  councilId: string
  scope: string | undefined
  onScope: (scope: string | null) => void
  onForbidden: () => void
}

export function PurchaseScope({ councilId, scope, onScope, onForbidden }: Props) {
  const [choosing, setChoosing] = useState(false)
  const eventScope = (scope !== undefined && isUuid(scope)) || choosing
  const events = useEvents(councilId, onForbidden, eventScope)
  const pick = (value: string | null) => {
    setChoosing(false)
    onScope(value)
  }
  return (
    <div className="flex flex-col gap-3">
      <PurchaseScopeChips
        scope={scope}
        eventScope={eventScope}
        onScope={pick}
        onEvent={() => setChoosing(true)}
      />
      {eventScope && <EventSelection scope={scope} events={events} onScope={pick} />}
    </div>
  )
}

function EventSelection({
  scope,
  events,
  onScope,
}: {
  scope: Props['scope']
  events: EventList
  onScope: Props['onScope']
}) {
  const options = events.state.kind === 'ready' ? events.state.data.events : []
  return (
    <>
      <Field label="행사">
        <NativeSelect
          className="max-w-full max-sm:min-h-11 sm:max-w-80"
          value={scope && isUuid(scope) ? scope : ''}
          onChange={e => onScope(e.target.value || null)}
        >
          <option value="">행사 선택</option>
          <EventOptions events={options} scope={scope} />
        </NativeSelect>
      </Field>
      {events.state.kind === 'loading' && (
        <StateMessage kind="loading">행사 불러오는 중…</StateMessage>
      )}
      {events.state.kind === 'failed' && (
        <div className="flex items-center gap-2">
          <StateMessage kind="error">행사를 불러오지 못했어요.</StateMessage>
          <Button touch variant="outline" onClick={() => void events.reload()}>
            행사 다시 시도
          </Button>
        </div>
      )}
      {events.state.kind === 'ready' && events.state.data.truncated && (
        <StateMessage kind="notice">최근 행사만 보여요.</StateMessage>
      )}
    </>
  )
}

export function PurchaseScopeChips({
  scope,
  eventScope,
  onScope,
  onEvent,
}: {
  scope: string | undefined
  eventScope: boolean
  onScope: Props['onScope']
  onEvent: () => void
}) {
  return (
    <div role="group" aria-label="구매 범위" className="flex flex-wrap gap-2">
      {[
        { label: '전체', selected: !scope && !eventScope, action: () => onScope(null) },
        { label: '상시', selected: scope === 'none' && !eventScope, action: () => onScope('none') },
        { label: '행사별', selected: eventScope, action: onEvent },
      ].map(item => (
        <Button
          key={item.label}
          touch
          size="sm"
          className="break-keep"
          variant={item.selected ? 'secondary' : 'outline'}
          aria-pressed={item.selected}
          onClick={item.action}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}

function EventOptions({ events, scope }: { events: EventSummary[]; scope: string | undefined }) {
  return (
    <>
      {scope && isUuid(scope) && !events.some(event => event.id === scope) && (
        <option value={scope}>선택한 행사</option>
      )}
      {events.map(event => (
        <option key={event.id} value={event.id}>
          {event.name}
        </option>
      ))}
    </>
  )
}
