import { useState } from 'react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskBoard } from '@/tasks/TaskBoard'
import { useSplit } from '@/lib/use-split'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const uuid = (tail: string) => `0199d1a0-0000-7000-8000-0000000000${tail}`
const nextOf: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
}
const initialTasks: TaskSummary[] = [
  {
    id: uuid('a1'),
    title: '신입생 환영회 장소 예약',
    status: 'todo',
    next: 'in_progress',
    dueDate: '2026-10-26',
    overdue: false,
    department: { id: uuid('d1'), name: '기획부' },
    event: null,
    assignee: { id: uuid('b1'), name: '김새내', current: true },
    actions: ['task.change_status'],
  },
  {
    id: uuid('a2'),
    title: '의자 대여',
    status: 'todo',
    next: 'in_progress',
    dueDate: '2026-10-20',
    overdue: true,
    department: null,
    event: null,
    assignee: null,
    actions: ['task.change_status'],
  },
  {
    id: uuid('a3'),
    title: `${longName} ${unbroken}`,
    status: 'in_progress',
    next: 'done',
    dueDate: null,
    overdue: false,
    department: { id: uuid('d1'), name: longName },
    event: null,
    assignee: { id: uuid('b2'), name: longName, current: false },
    actions: ['task.change_status'],
  },
  {
    id: uuid('a4'),
    title: '포스터 시안 확인',
    status: 'in_progress',
    next: 'done',
    dueDate: null,
    overdue: false,
    department: null,
    event: null,
    assignee: null,
    actions: [],
  },
  {
    id: uuid('a5'),
    title: '장소 답사',
    status: 'done',
    next: null,
    dueDate: null,
    overdue: false,
    department: null,
    event: null,
    assignee: null,
    actions: ['task.change_status'],
  },
]
const list = (tasks: TaskSummary[]) => ({
  state: { kind: 'ready' as const, tasks, truncated: false },
  reload: async () => {},
})

function Sample({ phone = false }: { phone?: boolean }) {
  const wide = useSplit()
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [tasks, setTasks] = useState(initialTasks)
  const [opened, setOpened] = useState<TaskSummary | null>(null)
  return (
    <>
      <TaskBoard
        open={list(tasks.filter(task => task.status !== 'done'))}
        done={list(tasks.filter(task => task.status === 'done'))}
        departments={[{ id: uuid('d1') }]}
        change={{
          busy: new Set<string>(),
          errors: {},
          change: (id, next) => {
            setTasks(before =>
              before.map(task =>
                task.id === id ? { ...task, status: next, next: nextOf[next] } : task,
              ),
            )
            return Promise.resolve()
          },
        }}
        onOpenTask={id => setOpened(tasks.find(task => task.id === id) ?? null)}
        onShowDoneTable={() => {}}
        councilEmpty={false}
        emptyText="업무 없음"
        mobile={phone || !wide ? { status, onStatus: setStatus } : undefined}
      />
      <Dialog
        open={opened !== null}
        onOpenChange={open => {
          if (!open) setOpened(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opened?.title}</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 같은 카드로 390px 한 상태 목록과 1280px 본문의 상태 열을 비교한다. 탭·상태 변경·제목 열기가 실제로 동작한다.
export function TaskMobileBoardSection() {
  return (
    <Section title="업무 휴대폰 상태 탭">
      <div className="w-97.5 max-w-full">
        <p className="mb-3 text-xs text-muted-foreground">390px</p>
        <Sample phone />
      </div>
      <div className="w-full">
        <p className="mb-3 text-xs text-muted-foreground">1280px 창</p>
        <Sample />
      </div>
    </Section>
  )
}
