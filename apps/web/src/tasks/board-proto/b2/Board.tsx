import { Circle, CircleCheck, CircleDot, FileText, type LucideIcon } from 'lucide-react'
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

// b2 한 줄 카드: 열 상자 없이 화면을 셋으로 나누고, 카드는 넓은 폭을 가로로 쓰는 한 줄(제목 … 부서 칩 · 마감 · 얼굴).
// 카드 폭이 448px 아래면(1280) 제목 / 나머지 두 줄로 접힌다. 부서 색은 칩 바탕 하나(띠 없음).

const GLYPH: Record<Status, { icon: LucideIcon; tone: string }> = {
  todo: { icon: Circle, tone: 'text-fg-subtle' },
  doing: { icon: CircleDot, tone: 'text-primary-mark' },
  done: { icon: CircleCheck, tone: 'text-success-emphasis' },
}

function Due({ task }: { task: Task }) {
  if (task.overdue && task.status !== 'done')
    return (
      <span data-overdue className={cn(T.DUE, 'font-semibold text-danger')}>
        {task.due} · 지남
      </span>
    )
  return <span className={cn(T.DUE, 'text-fg-muted')}>{task.due ?? '마감 없음'}</span>
}

function Card({ task, grouped = false }: { task: Task; grouped?: boolean }) {
  const dept = deptOf(task)
  const done = task.status === 'done'
  return (
    <li data-card className={cn('group/card relative', T.CARD)}>
      <div className={T.CARD_BODY}>
        <Button
          variant="link"
          className={cn(
            'h-auto min-w-0 flex-1 justify-start p-0 text-left whitespace-normal hover:no-underline',
            T.AREA_TITLE,
            done ? T.TITLE_DONE : T.TITLE,
            STRETCH,
          )}
        >
          <span className="line-clamp-2 wrap-anywhere @md:line-clamp-1">{task.title}</span>
        </Button>
        <div className={cn(T.META, T.AREA_META)}>
          {!grouped && (
            <span className={cn('min-w-0 truncate', T.DEPT_CHIP, dept.tint.chip)}>{dept.name}</span>
          )}
          <Due task={task} />
          {task.result && (
            <FileText aria-label="결과물 있음" className="size-3.5 shrink-0 text-fg-muted" />
          )}
        </div>
        <span className={cn(T.WHO, T.AREA_WHO)}>
          {task.assignee ? (
            <Face name={task.assignee} className={T.FACE} />
          ) : (
            <span className="whitespace-nowrap text-fg-muted">담당자 없음</span>
          )}
          <CardMenu title={task.title} className={T.MENU} />
        </span>
      </div>
    </li>
  )
}

function Column({ status, tasks, adding }: { status: Status; tasks: Task[]; adding: boolean }) {
  const { icon: Icon, tone } = GLYPH[status]
  return (
    <section data-column={status} aria-label={STATUS_LABEL[status]} className="min-w-0">
      <h2 className={cn(T.COL_HEAD, T.COL_LINE[status])}>
        <Icon aria-hidden className={cn(T.COL_GLYPH, tone)} strokeWidth={2.25} />
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

export function B2Board({ sample }: { sample: Sample }) {
  return (
    <div className="flex flex-col gap-4">
      <Toolbar tasks={sample.tasks} depts="chips" />
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
  )
}

export function B2List({ sample }: { sample: Sample }) {
  const todo = byStatus(sample.tasks, 'todo')
  return (
    <MobileShell tasks={sample.tasks}>
      <div className="flex flex-col gap-1">
        {groupByDept(todo).map(group => (
          <section key={group.dept.key}>
            <h3 className="flex h-8 items-center gap-2 px-1">
              <span className={cn(T.DEPT_CHIP, group.dept.tint.chip)}>{group.dept.name}</span>
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
