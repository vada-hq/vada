import { useState } from 'react'
import { Search } from 'lucide-react'
import { EVENT_LIST_LIMIT, type RecordEventItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { RecordEventCard } from './RecordEventCard'
import { RECORD_ORDERS, RECORD_TEXT, visibleRecords, type RecordOrder } from './record-view'

type Props = {
  events: RecordEventItem[]
  truncated: boolean
  // 올해 판단용이다(부품 확인 화면이 고정한다).
  now?: Date | undefined
  onOpen: (eventId: string) => void
}

// 완료된 행사 목록(와이어프레임 REC-01): 행사명 찾기와 정렬, 카드 목록. 찾기와 정렬은 행사 목록처럼 화면에만 둔다.
// 미발행 안내와 설명 글은 두지 않는다(DEC-110 살, 화면 문구 최소).
export function RecordEventList({ events, truncated, now, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<RecordOrder>('completed')
  if (events.length === 0)
    return <p className="py-8 text-center text-sm text-fg-muted">{RECORD_TEXT.empty}</p>
  const shown = visibleRecords(events, query, order)
  return (
    <div className="@container flex min-w-0 flex-col gap-4 break-keep">
      <div className="flex min-w-0 max-w-220 flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 @xl:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-3 left-3 size-4 text-fg-subtle"
          />
          <Input
            type="search"
            aria-label="행사명 찾기"
            value={query}
            // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내다(AGENTS.md).
            placeholder="행사명 찾기"
            className="pl-9 max-sm:min-h-11"
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="정렬"
          value={order}
          className="ml-auto w-40 max-sm:min-h-11"
          onChange={e => setOrder(e.target.value as RecordOrder)}
        >
          {RECORD_ORDERS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">{RECORD_TEXT.noMatch}</p>
      ) : (
        <ul
          aria-label="완료된 행사 목록"
          className="grid w-full min-w-0 max-w-220 grid-cols-1 gap-3"
        >
          {shown.map(event => (
            <li key={event.id} className="min-w-0">
              <RecordEventCard event={event} now={now} onOpen={() => onOpen(event.id)} />
            </li>
          ))}
        </ul>
      )}
      {truncated && (
        <StateMessage kind="notice">{`행사가 많아서 ${EVENT_LIST_LIMIT}개만 보여요.`}</StateMessage>
      )}
    </div>
  )
}
