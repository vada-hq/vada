import { Archive } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayOf, eventDayText, recordChips, retrospectiveLabels, retrospectiveTones } from './record-view'
import { useRecords } from './useRecords'

type Props = { organizationId: string; onOpen: (event: EventSummary) => void }

// 완료한 행사 목록(REC-01). 최근 완료 순이다. 누르면 결과보고서가 열린다. 회고가 없어도 기록은 완성이라 칩만 없다.
export default function Records({ organizationId, onOpen }: Props) {
  const { data, loadError, refresh } = useRecords(organizationId)
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-3">
    {loadError && !data ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">기록을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" size="sm" onClick={refresh}>다시 불러오기</Button></div>
      : !data ? <StateMessage kind="loading">기록 불러오는 중…</StateMessage>
      : data.records.length ? <ul className="flex flex-col gap-2" aria-label="완료한 행사">{data.records.map(({ event, retrospective, facts }) => {
        const chips = recordChips(facts)
        // 날짜 옆은 담당 부서, 없으면 책임자다(REC-01).
        const owner = facts.owner.department ?? facts.owner.person
        return <li key={event.id}><article className={cn(cardClass, 'flex flex-col gap-1.5 p-4')}>
          {retrospective && <div><Badge tone={retrospectiveTones[retrospective]}>{retrospectiveLabels[retrospective]}</Badge></div>}
          <h2 className="text-sm">
            <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
              onClick={() => onOpen(event)}>{event.name}</Button>
          </h2>
          <p className="text-xs wrap-anywhere text-gray-500">{[eventDayText(facts.event.startsAt), owner].filter(Boolean).join(' · ')}</p>
          {chips.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="숫자">
            {chips.map(chip => <li key={chip}><Badge tone="neutral">{chip}</Badge></li>)}</ul>}
          <p className="text-xs text-gray-400">완료 {dayOf(event.completedAt!)}</p>
        </article></li>
      })}</ul>
      : <Card><EmptyState icon={Archive} title="완료한 행사가 아직 없어요" description="정산한 행사를 회장단이 완료하면 여기에 모여요." /></Card>}
  </div></div>
}
