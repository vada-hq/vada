import { Plus, RefreshCw } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/components/ui/nav-item'

type Props = {
  events: EventSummary[] | null; loading: boolean; error: string; saving: boolean
  selectedId?: string; onSelect: (event: EventSummary) => void; onRefresh: () => void; onCreate?: () => void
}
export default function EventList({ events, loading, error, saving, selectedId, onSelect, onRefresh, onCreate }: Props) {
  return <nav aria-label="행사 목록" className="flex flex-col gap-1">
    <div className="flex items-center gap-1 pl-3">
      <h2 className="mr-auto text-xs font-medium text-gray-400">행사</h2>
      <Button variant="ghost" size="icon" aria-label="목록 새로고침" disabled={loading || saving} onClick={onRefresh}><RefreshCw /></Button>
      {onCreate && <Button variant="ghost" size="sm" onClick={onCreate}><Plus />새 행사</Button>}
    </div>
    {loading ? <StateMessage kind="loading" className="px-3">행사 목록 불러오는 중…</StateMessage> : error ? <StateMessage kind="error" className="px-3">{error}</StateMessage>
      : events?.length ? <ul className="flex flex-col gap-0.5">{events.map(event => <li key={event.id}>
        <NavItem active={selectedId === event.id} onClick={() => onSelect(event)}>{event.name}</NavItem>
      </li>)}</ul> : <StateMessage kind="empty" className="px-3 text-xs">아직 행사가 없어요.</StateMessage>}
  </nav>
}
