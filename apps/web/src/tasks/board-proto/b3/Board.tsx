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

// b3 흰 묶음 줄: 회색 쟁반 하나에 열 셋(열마다 폭 상한 448px, 묶음은 가운데). 열마다 흰 묶음 하나, 업무는 구분선으로 나뉜 두 칸 줄.
// 부서 색은 줄 왼쪽 띠 하나, 부서 이름은 회색 글(띠와 칩이 같은 말을 두 번 하지 않게). 홈 ① f8 가족.

function Due({ task }: { task: Task }) {
  if (task.overdue && task.status !== 'done')
    return (
      <span data-overdue className="shrink-0 font-semibold text-danger">
        {task.due} · 지남
      </span>
    )
  return <span className="shrink-0 text-fg-muted">{task.due ?? '마감 없음'}</span>
}

function Row({ task, grouped = false }: { task: Task; grouped?: boolean }) {
  const dept = deptOf(task)
  const done = task.status === 'done'
  return (
    <li data-card className={cn('group/card relative', T.ROW)}>
      {!grouped && <span aria-hidden className={cn(T.BAND, dept.tint.fill)} />}
      <div className="min-w-0 flex-1">
        <Button
          variant="link"
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left whitespace-normal hover:no-underline',
            done ? T.TITLE_DONE : T.TITLE,
            STRETCH,
          )}
        >
          <span className="line-clamp-2 wrap-anywhere">{task.title}</span>
        </Button>
        <p className={T.SUB}>
          {!grouped && (
            <>
              <span className="min-w-0 truncate text-fg-tertiary">{dept.name}</span>
              <span aria-hidden className="text-fg-muted">
                ·
              </span>
            </>
          )}
          <Due task={task} />
          {task.result && (
            <FileText aria-label="결과물 있음" className="size-3.5 shrink-0 text-fg-muted" />
          )}
        </p>
      </div>
      <span className={T.WHO}>
        {task.assignee ? (
          <>
            <Face name={task.assignee} className={T.FACE} />
            <span aria-hidden className={T.WHO_NAME}>
              {task.assignee}
            </span>
          </>
        ) : (
          <span className="text-fg-muted">담당자 없음</span>
        )}
      </span>
      <CardMenu title={task.title} className={T.MENU} />
    </li>
  )
}

function Column({ status, tasks, adding }: { status: Status; tasks: Task[]; adding: boolean }) {
  return (
    <section data-column={status} aria-label={STATUS_LABEL[status]} className="min-w-0">
      <h2 className={T.COL_HEAD}>
        <span className={T.COL_NAME}>{STATUS_LABEL[status]}</span>
        <span data-count className={T.COL_COUNT}>
          {countText(tasks.length)}
        </span>
      </h2>
      <div className={cn('@container', T.GROUP)}>
        {tasks.length === 0 && status !== 'todo' ? (
          <p className={T.EMPTY}>업무 없음</p>
        ) : (
          <ul className={T.DIVIDE}>
            {tasks.map(task => (
              <Row key={task.id} task={task} />
            ))}
          </ul>
        )}
        {status === 'todo' && (
          <div className="border-t border-border-subtle pt-1">
            <AddTask open={adding} closedClass={T.ADD} openClass={T.ADD_OPEN} />
          </div>
        )}
      </div>
    </section>
  )
}

export function B3Board({ sample }: { sample: Sample }) {
  return (
    <div className={cn('flex flex-col gap-4', T.WIDTH)}>
      <Toolbar tasks={sample.tasks} depts="chips" />
      <div className={T.TRAY}>
        <div className={T.COLS}>
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
    </div>
  )
}

// 휴대폰: 쟁반 위 부서 묶음마다 흰 묶음 하나. 묶음 머리가 부서를 말하므로 줄에서 띠·부서 이름을 뺀다.
export function B3List({ sample }: { sample: Sample }) {
  const todo = byStatus(sample.tasks, 'todo')
  return (
    <MobileShell tasks={sample.tasks}>
      <div className={cn('flex flex-col', T.TRAY)}>
        {groupByDept(todo).map(group => (
          <section key={group.dept.key}>
            <h3 className="flex items-center gap-2 px-3 pt-1.5 pb-1.5">
              <span aria-hidden className={cn('size-2.5 rounded-full', group.dept.tint.fill)} />
              <span className="text-[15px] font-bold text-fg">{group.dept.name}</span>
              <span className="text-[15px] font-semibold text-fg-tertiary">
                {group.tasks.length}
              </span>
            </h3>
            <div className={cn('@container', T.GROUP)}>
              <ul className={T.DIVIDE}>
                {group.tasks.map(task => (
                  <Row key={task.id} task={task} grouped />
                ))}
              </ul>
            </div>
          </section>
        ))}
        <div className={cn('mt-2', T.GROUP)}>
          <AddTask open={sample.adding} closedClass={T.ADD} openClass={T.ADD_OPEN} />
        </div>
      </div>
    </MobileShell>
  )
}
