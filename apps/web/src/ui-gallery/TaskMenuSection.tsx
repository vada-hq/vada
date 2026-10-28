import { useState } from 'react'
import type { TaskTab, TaskView } from '@vada/contracts'
import { TaskTabs } from '@/tasks/TaskTabs'
import { Section } from './GallerySection'

const DEPARTMENT = '0199d1a0-0000-7000-8000-0000000000d1'

function TaskScopeExample({ menu }: { menu: boolean }) {
  const [tab, setTab] = useState<TaskTab>('council')
  const [view, setView] = useState<TaskView>('all')
  const [dept, setDept] = useState<string | null>(null)
  const [assignee, setAssignee] = useState<string | null>(null)
  const [includeEvents, setEvents] = useState(false)
  return (
    <div className="w-full">
      <TaskTabs
        tab={menu ? { value: tab, onChange: setTab } : undefined}
        view={menu ? (tab === 'mine' ? 'mine' : 'all') : view}
        filter="open"
        onView={setView}
        onFilter={() => {}}
        myDepartment={DEPARTMENT}
        showFilter={false}
        scope={{
          inMenu: menu,
          dept,
          assignee,
          includeEvents,
          setDept,
          toggleUnassigned: () => setAssignee(assignee === 'none' ? null : 'none'),
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
    </>
  )
}
