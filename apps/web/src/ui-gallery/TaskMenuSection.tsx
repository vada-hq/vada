import { useState } from 'react'
import type { TaskTab, TaskView } from '@vada/contracts'
import { TaskTabs } from '@/tasks/TaskTabs'
import { TaskUndoBar } from '@/tasks/TaskUndoBar'
import { chipChange } from '@/tasks/task-chips'
import type { TaskSort } from '@/tasks/task-sort'
import { BOARD_SCOPE, CHIP_LABEL, NO_DEPARTMENT } from '@/tasks/task-chip-text'
import { Section } from './GallerySection'

const DEPARTMENT = '0199d1a0-0000-7000-8000-0000000000d1'

const PERSON = '0199d1a0-0000-7000-8000-000000000001'
const SAMPLE_COUNTS = { overdue: 2, mine: 3, unassigned: 2, noDue: 1 }
const ZERO_COUNTS = { overdue: 0, mine: 3, unassigned: 0, noDue: 0 }

function exampleLabel({
  view,
  due,
  assignee,
  dept,
}: {
  view: TaskView
  due: string | null
  assignee: string | null
  dept: string | null
}) {
  return [
    view === 'mine' ? BOARD_SCOPE.mine : null,
    due === 'overdue' ? CHIP_LABEL.overdue : null,
    due === 'none' ? CHIP_LABEL.noDue : null,
    assignee === 'none' ? CHIP_LABEL.unassigned : null,
    assignee === PERSON ? '김새내' : null,
    dept === 'none' ? NO_DEPARTMENT : dept ? '기획부' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function TaskScopeExample({
  menu,
  truncated = false,
  zero = false,
}: {
  menu: boolean
  truncated?: boolean
  zero?: boolean
}) {
  const [tab, setTab] = useState<TaskTab>('council')
  const [view, setView] = useState<TaskView>('all')
  const [dept, setDept] = useState<string | null>(null)
  const [assignee, setAssignee] = useState<string | null>(null)
  const [includeEvents, setEvents] = useState(false)
  const [due, setDue] = useState<string | null>(null)
  const [sort, setSort] = useState<TaskSort>('department')
  const label = exampleLabel({ view, due, assignee, dept })
  return (
    <div className="w-full">
      <TaskTabs
        tab={menu ? { value: tab, onChange: setTab } : undefined}
        view={tab === 'mine' ? 'mine' : view}
        filter="open"
        onView={setView}
        onFilter={() => {}}
        chips={{
          counts: zero ? ZERO_COUNTS : SAMPLE_COUNTS,
          truncated,
          departments: [{ id: DEPARTMENT, name: '기획부' }],
          members: [{ id: PERSON, name: '김새내' }],
        }}
        narrow={
          label
            ? {
                label,
                onClear: () => {
                  setView('all')
                  setDept(null)
                  setAssignee(null)
                  setDue(null)
                  setEvents(false)
                },
              }
            : undefined
        }
        showFilter={false}
        sort={{ value: sort, onChange: setSort }}
        scope={{
          inMenu: menu,
          dept,
          due,
          assignee,
          includeEvents,
          setDept,
          setAssignee,
          toggleChip: chip => {
            const next = chipChange({ due, assignee }, chip)
            setDue(next.due)
            if ('assignee' in next) setAssignee(next.assignee ?? null)
          },
          toggleEvents: () => setEvents(!includeEvents),
        }}
      />
    </div>
  )
}

export function TaskMenuSection() {
  return (
    <>
      <Section title="업무 메뉴 · 두 탭과 범위 칩">
        <TaskScopeExample menu />
      </Section>
      <Section title="행사 업무 · 범위 칩과 토글">
        <TaskScopeExample menu={false} />
      </Section>
      <Section title="업무 행사 이동 안내">
        <TaskUndoBar
          bar={{
            taskId: '0199d1a0-0000-7000-8000-000000000001',
            previousId: null,
            event: { id: '0199d1a0-0000-7000-8000-000000000002', name: '신입생 환영회' },
            busy: false,
            error: null,
          }}
          dismiss={() => {}}
          undo={() => {}}
          onOpenEvent={() => {}}
        />
      </Section>
    </>
  )
}
