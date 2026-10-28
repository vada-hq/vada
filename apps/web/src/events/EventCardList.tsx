import { Search } from 'lucide-react'
import type { EventCard } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import EventRow from './EventRow'
import { EVENT_FILTERS, type EventOrder } from './event-view'
import { useEventFilters } from './useEvents'

export function EventCardList({
  events,
  onOpen,
}: {
  events: EventCard[]
  onOpen: (id: string) => void
}) {
  const filters = useEventFilters(events)
  return (
    <div className="@container flex min-w-0 flex-col gap-4 break-keep">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 @xl:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-3 left-3 size-4 text-gray-400"
          />
          <Input
            type="search"
            aria-label="행사명 찾기"
            value={filters.query}
            // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내다(AGENTS.md).
            placeholder="행사명 찾기"
            className="pl-9 max-sm:min-h-11"
            onChange={e => filters.setQuery(e.target.value)}
          />
        </div>
        <div role="group" aria-label="행사 상태" className="flex flex-wrap gap-2">
          {EVENT_FILTERS.map(filter => (
            <Button
              key={filter}
              touch
              size="sm"
              variant={filters.filter === filter ? 'default' : 'outline'}
              className="rounded-full"
              aria-pressed={filters.filter === filter}
              onClick={() => filters.setFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
        <NativeSelect
          aria-label="정렬"
          value={filters.order}
          className="ml-auto w-40 max-sm:min-h-11"
          onChange={e => filters.setOrder(e.target.value as EventOrder)}
        >
          <option value="date">행사 일시순</option>
          <option value="activity">최근 활동순</option>
        </NativeSelect>
      </div>
      {filters.events.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">결과 없음</p>
      ) : (
        <ul aria-label="행사 목록" className="grid w-full min-w-0 max-w-220 grid-cols-1 gap-3">
          {filters.events.map(event => (
            <li key={event.id} className="min-w-0">
              <EventRow event={event} onOpen={() => onOpen(event.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
