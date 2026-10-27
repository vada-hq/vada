import { useState } from 'react'
import type { TaskDetail } from '@vada/contracts'
import { HistoryMenu } from '@/components/HistoryMenu'
import { departmentColorOf } from '@/tasks/department-color'
import { TaskCard } from '@/tasks/TaskCard'
import { TaskDetailFrame } from '@/tasks/TaskDetailFrame'
import { TaskDetailView } from '@/tasks/TaskDetailView'
import { TaskInlineText } from '@/tasks/TaskInlineText'
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

function SampleDetail({
  task,
  onChange,
  onClose,
}: {
  task: TaskDetail
  onChange: (task: TaskDetail) => void
  onClose: () => void
}) {
  const onEdit = (edit: Parameters<typeof applySampleEdit>[1]) => {
    onChange(applySampleEdit(task, edit))
    return true
  }
  return (
    <TaskDetailFrame
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
        onEdit={onEdit}
        onMake={noop}
        openerOf={result => (result.title === null ? null : noop)}
        onOpenEvent={noop}
      />
    </TaskDetailFrame>
  )
}

// 업무 상세 오른쪽 패널. 카드를 누르면 상세가 열리고, 값을 누르면 고르기 창이 열려 바로 바뀐다(서버 없음).
export function TaskDetailSection() {
  const [tasks, setTasks] = useState(sampleTasks)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = tasks.find(task => task.id === openId)
  return (
    <Section title="업무 상세">
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
          onChange={next => setTasks(list => list.map(task => (task.id === next.id ? next : task)))}
          onClose={() => setOpenId(null)}
        />
      )}
    </Section>
  )
}
