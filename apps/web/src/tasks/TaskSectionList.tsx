import type { ReactNode } from 'react'
import type { TaskSummary } from '@vada/contracts'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { sectionSummary, type TaskSection } from './task-groups'

type Props = {
  sections: TaskSection[]
  // 부서 묶음이면 머리에 진행 중·지남·담당자 없음 수를 적는다(요구 14, 20).
  summary: boolean
  row: (task: TaskSummary) => ReactNode
}

// 묶음 머리 오른쪽의 수. 0인 것은 빼고 명사형으로 잇는다.
export function SummaryText({ tasks }: { tasks: TaskSummary[] }) {
  const { inProgress, overdue, unassigned } = sectionSummary(tasks)
  const parts = [
    inProgress > 0 && { text: `진행 중 ${inProgress}`, tone: 'text-fg-muted' },
    overdue > 0 && { text: `지남 ${overdue}`, tone: 'text-danger-emphasis' },
    unassigned > 0 && { text: `담당자 없음 ${unassigned}`, tone: 'text-warning' },
  ].filter(part => part !== false)
  return (
    <span className="flex flex-wrap gap-x-2 text-xs">
      {parts.map(part => (
        <span key={part.text} className={part.tone}>
          {part.text}
        </span>
      ))}
    </span>
  )
}

// 묶음마다 머리(이름과 수)와 줄 목록 한 장. 지남 묶음의 이름은 빨갛게 둔다.
export function TaskSectionList({ sections, summary, row }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map(section => (
        <section key={section.key} aria-label={section.title} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2
              className={cn(
                'text-sm font-semibold wrap-anywhere',
                section.key === 'overdue' ? 'text-danger-emphasis' : 'text-fg',
              )}
            >
              {section.title}
              <span className="ml-1.5 font-normal text-fg-muted">{section.tasks.length}</span>
            </h2>
            {summary && <SummaryText tasks={section.tasks} />}
          </div>
          <ul className={cn(cardClass, 'divide-y')}>{section.tasks.map(row)}</ul>
        </section>
      ))}
    </div>
  )
}
