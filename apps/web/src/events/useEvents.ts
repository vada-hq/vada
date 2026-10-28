import { useState } from 'react'
import { statusOf, type EventCard, type EventsResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { eventsPath } from './event-api'
import { visibleEvents, type EventFilter, type EventOrder } from './event-view'

// 행사 목록. 화면이 보이는 동안 15초마다, 다시 보일 때 다시 읽는다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useEvents(councilId: string, onForbidden: () => void, enabled = true) {
  return usePolledRead<EventsResponse>(
    eventsPath(councilId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    enabled,
  )
}
export type EventList = ReturnType<typeof useEvents>

export function useEventFilters(events: EventCard[]) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EventFilter>('전체')
  const [order, setOrder] = useState<EventOrder>('date')
  return {
    query,
    setQuery,
    filter,
    setFilter,
    order,
    setOrder,
    events: visibleEvents(events, query, filter, order),
  }
}
