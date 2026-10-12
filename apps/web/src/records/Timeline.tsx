import { useId } from 'react'
import type { RecordEntry, RecordTab } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayHeading } from './record-view'

type Props = {
  entries: RecordEntry[]
  // 행사 시작일(한국 날짜). 없으면 D-n 없이 날짜만 적는다.
  eventDay: string | null
  // 참가자 탭은 부서가 있는 구성원에게만 보인다. 못 보면 참가 신청 줄을 누를 수 없다.
  canOpenRegistrations: boolean
  onOpen: (tab: RecordTab) => void
}

// 결과보고서의 준비 과정(M5c). 서버가 행사 기록에서 모은 줄을 날짜마다 묶는다. 줄을 누르면 그 기록이 있는 행사 탭으로 간다.
export default function Timeline({ entries, eventDay, canOpenRegistrations, onOpen }: Props) {
  const heading = useId()
  const days: { day: string; entries: RecordEntry[] }[] = []
  for (const entry of entries) {
    const last = days.at(-1)
    if (last?.day === entry.day) last.entries.push(entry)
    else days.push({ day: entry.day, entries: [entry] })
  }
  return <section aria-labelledby={heading} className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
    <div className="flex flex-col gap-1">
      <h3 id={heading} className="text-sm font-semibold text-gray-900">준비 과정</h3>
      <p className="text-xs text-gray-500">행사 기록에서 자동으로 모았어요. 줄을 누르면 그 기록으로 가요.</p>
    </div>
    <ol className="flex flex-col gap-3">{days.map(group => <li key={group.day} className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-gray-500">{dayHeading(group.day, eventDay)}</h4>
      <ul className="flex flex-col">{group.entries.map(entry => {
        const tab = entry.tab === 'registrations' && !canOpenRegistrations ? null : entry.tab
        const body = <>
          <span className={cn('text-sm font-medium wrap-anywhere', entry.warning ? 'text-amber-700' : 'text-gray-900')}>{entry.text}</span>
          {entry.note && <span className="text-xs wrap-anywhere text-gray-500">{entry.note}</span>}
        </>
        return <li key={entry.id}>{tab
          ? <Button variant="ghost" className="h-auto w-full flex-col items-start justify-start gap-0.5 px-2 py-1.5 text-left whitespace-normal"
            onClick={() => onOpen(tab)}>{body}</Button>
          : <div className="flex flex-col gap-0.5 px-2 py-1.5">{body}</div>}</li>
      })}</ul>
    </li>)}</ol>
  </section>
}
