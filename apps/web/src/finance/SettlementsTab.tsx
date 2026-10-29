import { EVENT_SETTLEMENTS_LIMIT } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { useSplit } from '@/lib/use-split'
import { EventSettlementList } from './EventSettlementList'
import { EventSettlementTable } from './EventSettlementTable'
import { useEventSettlements } from './useEventSettlements'

type Props = { councilId: string; onForbidden: () => void }

// 결산 탭의 '행사 정산' 구역: 지금 회계 기간의 행사마다 정산 남은 것 수. 모든 운영진이 같은 목록을 보고 처리는 행사의 재정 탭에서 한다.
export function SettlementsTab({ councilId, onForbidden }: Props) {
  const { state, reload } = useEventSettlements(councilId, onForbidden)
  // 넓은 화면(lg)은 재정 개요의 행사별 표와 같은 표, 그보다 좁으면 카드 줄이다(업무 목록과 같은 판정).
  // 옆 메뉴가 생기는 md 폭에서는 본문이 좁아 이름 칸이 무너지므로 표를 두지 않는다.
  const wide = useSplit()
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
  const List = wide ? EventSettlementTable : EventSettlementList
  return (
    <div className="flex flex-col gap-3">
      {period && <h3 className="text-base font-medium wrap-anywhere text-fg">{period.name}</h3>}
      {events.length === 0 ? (
        <StateMessage kind="empty">행사 없음</StateMessage>
      ) : (
        <List
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
