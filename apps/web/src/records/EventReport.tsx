import { useEffect } from 'react'
import type { EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { StatGrid } from '@/components/StatGrid'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { eventTimeText } from '../public/registration-text'
import { dayOf, factStats, ownerText } from './record-view'
import Retrospective, { type OpenTarget } from './Retrospective'
import Timeline from './Timeline'
import { useEventReport } from './useEventReport'

type Props = {
  organizationId: string
  eventId: string
  // 부서가 있는 구성원. 회고를 만들고 고치며, 참가자 탭도 이 사람에게만 보인다.
  canWrite: boolean
  // 볼 수만 있는 행사 화면을 연다. 탭과 대화 메시지를 넘기면 그곳으로 간다.
  onOpenEvent: (target?: OpenTarget) => void
  // 고치는 중인 회고가 있는지. 다른 화면으로 갈 때 묻는 데 쓴다.
  onDirtyChange: (dirty: boolean) => void
  // 받은 행사로 행사 목록을 바꾼다(다른 곳에서 완료를 취소했을 수 있다).
  onEvent: (event: EventSummary) => void
}

// 완료한 행사의 결과보고서(REC-02, M5c). 숫자와 준비 과정은 행사 기록에서 저절로 채우고, 회고는 끼룩이 초안이다. 휴대폰은 한 단이다.
export default function EventReport({ organizationId, eventId, canWrite, onOpenEvent, onDirtyChange, onEvent }: Props) {
  const state = useEventReport(organizationId, eventId)
  useEffect(() => { if (state.data) onEvent(state.data.event) }, [state.data, onEvent])
  if (!state.data) {
    return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl">
      {state.loadError ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">결과보고서를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={state.refresh}>다시 불러오기</Button></div>
        : <StateMessage kind="loading">결과보고서 불러오는 중…</StateMessage>}
    </div></div>
  }
  const { event, facts, timeline, retrospective } = state.data
  const completed = event.completedAt !== null
  const time = [eventTimeText(facts.event.startsAt, facts.event.endsAt) ?? '날짜 미정', facts.event.place].filter(Boolean).join(' · ')
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-4">
    {!completed && <Alert tone="warning">완료를 취소한 행사예요. 다시 완료하면 회고를 만들거나 고칠 수 있어요.</Alert>}
    <section aria-label="결과보고서 요약" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm wrap-anywhere text-gray-700">{time}</p>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenEvent()}>행사 기록 보기</Button>
      </div>
      <p className="text-sm wrap-anywhere text-gray-700">{ownerText(facts.owner) ?? '담당 미정'}</p>
      {event.completedAt && <p className="text-xs text-gray-500">완료 {dayOf(event.completedAt)}</p>}
    </section>
    <StatGrid label="행사 결과 숫자" className="grid-cols-2 sm:grid-cols-4" stats={factStats(facts)} />
    <p className="-mt-2 text-xs text-gray-500">지연은 마감일을 넘겨 끝냈거나 끝내지 않은 업무예요.</p>
    {/* 회고를 만들거나 고치거나 확인하면(revision) 새로 그려 고치기 상태를 닫는다. */}
    <Retrospective key={state.revision} retrospective={retrospective} state={state} canWrite={canWrite && completed} canOpenRegistrations={canWrite}
      onOpen={onOpenEvent} onDirtyChange={onDirtyChange} />
    <Timeline entries={timeline} eventDay={facts.event.startsAt?.slice(0, 10) ?? null} canOpenRegistrations={canWrite}
      onOpen={tab => onOpenEvent({ tab })} />
  </div></div>
}
