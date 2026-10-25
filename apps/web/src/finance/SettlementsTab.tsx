import { EVENT_SETTLEMENTS_LIMIT } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { EventSettlementList } from './EventSettlementList'
import { useEventSettlements } from './useEventSettlements'

type Props = { councilId: string; onForbidden: () => void }

// 재정 '행사 정산' 탭: 지금 회계 기간의 행사마다 정산 남은 것 수. 모든 운영진이 같은 목록을 보고 처리는 행사의 예산·정산에서 한다.
export function SettlementsTab({ councilId, onForbidden }: Props) {
  const { state, reload } = useEventSettlements(councilId, onForbidden)
  if (state.kind === 'loading')
    return <StateMessage kind="loading">행사 정산 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{SETTLEMENT_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void reload()}>
          다시 시도
        </Button>
      </div>
    )
  const { period, events, truncated } = state.data
  return (
    <div className="flex flex-col gap-3">
      {period && (
        <h2 className="text-base font-medium wrap-anywhere text-gray-900">{period.name}</h2>
      )}
      {events.length === 0 ? (
        <StateMessage kind="empty">행사 없음</StateMessage>
      ) : (
        <EventSettlementList
          rows={events}
          onOpen={eventId => openRecord('events', councilId, eventId, { tab: 'money' })}
        />
      )}
      {truncated && (
        <StateMessage kind="notice">{`행사가 많아서 ${EVENT_SETTLEMENTS_LIMIT}개만 보여요.`}</StateMessage>
      )}
    </div>
  )
}
