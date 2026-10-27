import { useState } from 'react'
import type { TaskDetail } from '@vada/contracts'
import { HistoryMenu } from '@/components/HistoryMenu'
import { Button } from '@/components/ui/button'
import { departmentColorOf } from '@/tasks/department-color'
import { TaskCard } from '@/tasks/TaskCard'
import { TaskDetailFrame, type TaskFrame } from '@/tasks/TaskDetailFrame'
import { TaskDetailView } from '@/tasks/TaskDetailView'
import { TaskInlineText } from '@/tasks/TaskInlineText'
import type { ResultsLayout } from '@/tasks/TaskResultList'
import { assigneeOptions, departmentOptions, eventOptions } from '@/tasks/task-pick-options'
import { versionLine } from '@/tasks/task-text'
import { Section } from './GallerySection'
import {
  applySampleEdit,
  sampleEvents,
  sampleTasks,
  sampleTeam,
  sampleToday,
} from './task-detail-samples'

const noop = () => {}

function Toggle<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: T
  choices: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      {choices.map(([key, name]) => (
        <Button
          key={key}
          size="sm"
          variant={key === value ? 'default' : 'outline'}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {name}
        </Button>
      ))}
    </div>
  )
}

function SampleDetail({
  task,
  frame,
  results,
  onChange,
  onClose,
}: {
  task: TaskDetail
  frame: TaskFrame
  results: ResultsLayout
  onChange: (task: TaskDetail) => void
  onClose: () => void
}) {
  const onEdit = (edit: Parameters<typeof applySampleEdit>[1]) => {
    onChange(applySampleEdit(task, edit))
    return true
  }
  return (
    <TaskDetailFrame
      frame={frame}
      title={task.title}
      busy={false}
      onClose={onClose}
      heading={
        <TaskInlineText
          field="title"
          value={task.title}
          editable={task.actions.includes('task.edit')}
          busy={false}
          onSave={title => title !== null && onEdit({ field: 'title', title })}
        />
      }
      menu={
        <HistoryMenu
          history={task.history}
          line={versionLine}
          actions={[
            { label: '링크 복사', onSelect: noop },
            ...(task.actions.includes('task.remove')
              ? [{ label: '지우기', destructive: true, onSelect: noop }]
              : []),
          ]}
        />
      }
    >
      <TaskDetailView
        task={task}
        today={sampleToday}
        busy={false}
        problem={null}
        options={{
          departments: departmentOptions(sampleTeam),
          assignees: assigneeOptions(sampleTeam, task),
          events: eventOptions(sampleEvents, task.event),
        }}
        results={results}
        onEdit={onEdit}
        onMake={noop}
        onOpenEvent={noop}
      />
    </TaskDetailFrame>
  )
}

// 업무 상세 다시 만들기 시안(notes/task-detail-redesign.md). 카드를 누르면 상세가 열리고, 값을 누르면 고르기 창이 열려 바로 바뀐다.
// 위의 고르기로 틀(오른쪽 패널·가운데 창)과 결과물 배치(만들기 메뉴·펼침)를 바꿔 견준다.
export function TaskDetailSection() {
  const [tasks, setTasks] = useState(sampleTasks)
  const [openId, setOpenId] = useState<string | null>(null)
  const [frame, setFrame] = useState<TaskFrame>('panel')
  const [results, setResults] = useState<ResultsLayout>('menu')
  const open = tasks.find(task => task.id === openId)
  return (
    <Section title="업무 상세 시안">
      <div className="flex w-full flex-wrap gap-x-6 gap-y-2">
        <Toggle
          label="틀"
          value={frame}
          choices={[
            ['panel', '오른쪽 패널'],
            ['dialog', '가운데 창'],
          ]}
          onChange={setFrame}
        />
        <Toggle
          label="결과물"
          value={results}
          choices={[
            ['menu', '만들기 메뉴'],
            ['inline', '펼침'],
          ]}
          onChange={setResults}
        />
      </div>
      <ul className="grid w-full grid-cols-1 gap-3 rounded-xl bg-gray-100/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            color={departmentColorOf(task.department?.id ?? null, sampleTeam.departments)}
            busy={false}
            hasResult={task.results.length > 0}
            onOpen={() => setOpenId(task.id)}
            menu={[
              { label: '링크 복사', onSelect: noop },
              ...(task.actions.includes('task.remove')
                ? [{ label: '지우기', destructive: true, onSelect: noop }]
                : []),
            ]}
          />
        ))}
      </ul>
      {open && (
        <SampleDetail
          task={open}
          frame={frame}
          results={results}
          onChange={next => setTasks(list => list.map(task => (task.id === next.id ? next : task)))}
          onClose={() => setOpenId(null)}
        />
      )}
    </Section>
  )
}
