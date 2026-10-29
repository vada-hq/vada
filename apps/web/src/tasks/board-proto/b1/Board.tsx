import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  byStatus,
  countText,
  deptOf,
  groupByDept,
  STATUS_LABEL,
  STATUSES,
  type Sample,
  type Status,
  type Task,
} from '../data'
import { AddTask, CardMenu, Face, MobileShell, STRETCH, Toolbar } from '../parts'
import * as T from './tokens'

// b1 좁은 열 카드: 회색 열 상자(300px 고정, 왼쪽부터) 위 흰 카드 2단. 부서 색은 점 + 부서 이름 글자 색(띠·칩 바탕 없음).

function Due({ task }: { task: Task }) {
  if (task.overdue && task.status !== 'done')
    return (
      <span data-overdue className="font-semibold text-danger">
        {task.due} · 지남
      </span>
    )
  return <span className="text-fg-muted">{task.due ?? '마감 없음'}</span>
}

// grouped: 휴대폰 목록은 부서 묶음 머리가 부서를 말하므로 카드에서 부서를 뺀다(지금 휴대폰 카드와 같음).
function Card({ task, grouped = false }: { task: Task; grouped?: boolean }) {
  const dept = deptOf(task)
  const done = task.status === 'done'
  return (
    <li data-card className={cn('group/card relative', T.CARD)}>
      <Button
        variant="link"
        className={cn(
          'h-auto w-full justify-start p-0 text-left whitespace-normal hover:no-underline',
          done ? T.TITLE_DONE : T.TITLE,
          STRETCH,
        )}
      >
        <span className="line-clamp-2 wrap-anywhere">{task.title}</span>
      </Button>
      <div className={T.META}>
        {!grouped && (
          <>
            <span aria-hidden className={cn('shrink-0', T.DEPT_DOT, dept.tint.fill)} />
            <span className={cn('min-w-0 truncate font-medium', dept.tint.text)}>{dept.name}</span>
            <span aria-hidden className="text-fg-muted">
              ·
            </span>
          </>
        )}
        <span className="shrink-0 whitespace-nowrap">
          <Due task={task} />
        </span>
        {task.result && (
          <FileText aria-label="결과물 있음" className="size-3.5 shrink-0 text-fg-muted" />
        )}
        <span className="ml-auto flex shrink-0 items-center">
          {task.assignee ? (
            <Face name={task.assignee} className={T.FACE} />
          ) : (
            <span className="text-fg-muted">담당자 없음</span>
          )}
        </span>
      </div>
      <CardMenu title={task.title} className={T.MENU_AT} />
    </li>
  )
}

function Column({ status, tasks, adding }: { status: Status; tasks: Task[]; adding: boolean }) {
  return (
    <section
      data-column={status}
      aria-label={STATUS_LABEL[status]}
      className={cn('shrink-0', T.COL_W, T.COL)}
    >
      <h2 className={T.COL_HEAD}>
        <span className={T.COL_NAME}>{STATUS_LABEL[status]}</span>
        <span data-count className={T.COL_COUNT}>
          {countText(tasks.length)}
        </span>
      </h2>
      {tasks.length === 0 && status !== 'todo' ? (
        <p className={T.EMPTY}>업무 없음</p>
      ) : (
        <ul className={cn('flex flex-col', T.CARD_GAP)}>
          {tasks.map(task => (
            <Card key={task.id} task={task} />
          ))}
        </ul>
      )}
      {status === 'todo' && <AddTask open={adding} closedClass={T.ADD} openClass={T.ADD_OPEN} />}
    </section>
  )
}

export function B1Board({ sample }: { sample: Sample }) {
  return (
    <div className="flex flex-col gap-4">
      <Toolbar tasks={sample.tasks} depts="chips" />
      <div className={cn('flex items-start', T.COLS_GAP)}>
        {STATUSES.map(status => (
          <Column
            key={status}
            status={status}
            tasks={byStatus(sample.tasks, status)}
            adding={sample.adding}
          />
        ))}
      </div>
    </div>
  )
}

export function B1List({ sample }: { sample: Sample }) {
  const todo = byStatus(sample.tasks, 'todo')
  return (
    <MobileShell tasks={sample.tasks}>
      <div className="flex flex-col gap-1">
        {groupByDept(todo).map(group => (
          <section key={group.dept.key}>
            <h3 className={T.LIST_HEAD}>
              <span className={T.COL_NAME}>{group.dept.name}</span>
              <span className={T.COL_COUNT}>{group.tasks.length}</span>
            </h3>
            <ul className={cn('flex flex-col', T.CARD_GAP)}>
              {group.tasks.map(task => (
                <Card key={task.id} task={task} grouped />
              ))}
            </ul>
          </section>
        ))}
        <AddTask open={sample.adding} closedClass={cn(T.ADD, 'min-h-11')} openClass={T.ADD_OPEN} />
      </div>
    </MobileShell>
  )
}
