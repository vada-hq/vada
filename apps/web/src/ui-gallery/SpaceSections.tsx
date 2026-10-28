import type { SidebarEvent } from '@vada/contracts'
import SpaceList from '../workspace/SpaceList'
import type { ActiveItem } from '../workspace/space-view'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}
const line = (id: string, name: string, status: SidebarEvent['status']): SidebarEvent => ({
  id,
  name,
  status,
})
const THREE = [
  line('e1', '2026 체육대회', 'ongoing'),
  line('e2', '2026학년도 새내기 배움터', 'upcoming'),
  line('e3', longName, 'ended'),
]
// 완료하지 않은 행사가 7개면 서버가 차례대로 5개를 준다.
const SEVEN = [
  line('e1', '2026 체육대회', 'ongoing'),
  line('e4', '가을 축제', 'ongoing'),
  line('e2', '2026학년도 새내기 배움터', 'upcoming'),
  line('e5', '학술제', 'tbd'),
  line('e3', longName, 'ended'),
]
const SAMPLES: { key: string; events: SidebarEvent[]; active: ActiveItem; canCreate: boolean }[] = [
  { key: '행사 0개, 만들 수 있음', events: [], active: null, canCreate: true },
  { key: '행사 0개, 부원', events: [], active: { kind: 'allEvents' }, canCreate: false },
  {
    key: '행사 3개, 첫 줄 켜짐',
    events: THREE,
    active: { kind: 'event', id: 'e1' },
    canCreate: true,
  },
  {
    key: '행사 7개(5개 보임)',
    events: SEVEN,
    active: { kind: 'event', id: 'e3' },
    canCreate: true,
  },
]

// 옆 메뉴 '행사' 묶음(028 조각 1, 와이어프레임 사이드바 v6.2 EVT-02 옆 메뉴). 넓은 화면의 옆 메뉴 폭(1280에서 240px)과
// 휴대폰 서랍 폭(420에서 288px)으로 본다. 셋째 줄은 긴 이름의 말줄임이다.
export function SpaceListSection() {
  const column = (width: string) => (
    <div className={`flex flex-col gap-4 ${width}`}>
      {SAMPLES.map(sample => (
        <div key={sample.key} className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">{sample.key}</p>
          <nav
            aria-label={`행사 예시 ${sample.key}`}
            className="rounded-lg border bg-white px-2 py-3"
          >
            <SpaceList
              events={sample.events}
              active={sample.active}
              onOpenEvent={noop}
              onSeeAll={noop}
              onNewEvent={sample.canCreate ? noop : undefined}
              lost={null}
            />
          </nav>
        </div>
      ))}
    </div>
  )
  return (
    <Section title="옆 메뉴 · 행사 묶음">
      {column('w-60')}
      {column('w-72')}
    </Section>
  )
}
