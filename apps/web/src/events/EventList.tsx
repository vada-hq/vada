import type { EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'

type Props = {
  events: EventSummary[] | null; loading: boolean; error: string; saving: boolean
  selectedId?: string; onSelect: (event: EventSummary) => void; onRefresh: () => void
}
export default function EventList({ events, loading, error, saving, selectedId, onSelect, onRefresh }: Props) {
  return <nav aria-label="행사 목록">
    <h2>행사</h2>
    {loading ? <StateMessage kind="loading">행사 목록 불러오는 중…</StateMessage> : error ? <StateMessage kind="error">{error}</StateMessage>
      : events?.length ? <ul className="event-list">{events.map(event => <li key={event.id}>
        <button type="button" className="button-quiet" aria-current={selectedId === event.id ? 'page' : undefined} onClick={() => onSelect(event)}>{event.name}</button>
      </li>)}</ul> : <StateMessage kind="empty" className="hint">아직 행사가 없어요.</StateMessage>}
    <button type="button" className="button-quiet" disabled={loading || saving} onClick={onRefresh}>목록 새로고침</button>
  </nav>
}
