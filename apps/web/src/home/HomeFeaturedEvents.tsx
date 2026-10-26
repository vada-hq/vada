import type { HomeResponse } from '@vada/contracts'
import EventStatusChip from '../events/EventStatusChip'
import { eventDayLabel } from './council-view'
import FeaturedEvents from './FeaturedEvents'

// 부원·재정부 인사 카드의 타일은 같은 응답·날짜·상태 칩을 쓴다(DEC-95).
export default function HomeFeaturedEvents({
  home,
  onOpen,
}: {
  home: HomeResponse
  onOpen: (id: string) => void
}) {
  return (
    <FeaturedEvents
      read={{
        kind: 'ready',
        tiles: home.featuredEvents.map(event => ({
          id: event.id,
          name: event.name,
          chip: <EventStatusChip status={event.status} />,
          when: eventDayLabel(event, home.today),
          onOpen: () => onOpen(event.id),
        })),
      }}
    />
  )
}
