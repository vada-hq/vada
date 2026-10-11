import { Archive } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatKoreanTime } from '../public/registration-text'

type Props = { events: EventSummary[] | null; loading: boolean; error: string; onOpen: (event: EventSummary) => void; onRefresh: () => void }
const day = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })

// 완료한 행사 목록(REC-01). 최근 완료 순이다. 누르면 볼 수만 있는 행사 화면이 열린다. 수치·결과보고서는 M5b에서 더한다.
export default function Records({ events, loading, error, onOpen, onRefresh }: Props) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-3">
    {loading ? <StateMessage kind="loading">기록 불러오는 중…</StateMessage>
      : error ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">{error}</StateMessage>
        <Button variant="outline" size="sm" onClick={onRefresh}>다시 불러오기</Button></div>
      : events?.length ? <ul className="flex flex-col gap-2" aria-label="완료한 행사">{events.map(event => <li key={event.id}>
        <article className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
          <h2 className="text-sm">
            <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
              onClick={() => onOpen(event)}>{event.name}</Button>
          </h2>
          <p className="text-xs text-gray-500">{event.startsAt ? formatKoreanTime(event.startsAt) : '날짜 미정'} · 완료 {day(event.completedAt!)}</p>
        </article>
      </li>)}</ul>
      : <Card><EmptyState icon={Archive} title="완료한 행사가 아직 없어요" description="정산한 행사를 회장단이 완료하면 여기에 모여요." /></Card>}
  </div></div>
}
