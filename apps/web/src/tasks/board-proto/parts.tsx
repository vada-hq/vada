import { useEffect, useRef, type ReactNode } from 'react'
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Columns3,
  Ellipsis,
  Plus,
  Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { NativeSelect } from '@/components/ui/native-select'
import { TabButton } from '@/components/ui/tab-button'
import { cn } from '@/lib/utils'
import { chipCounts, initialsOf, STATUS_LABEL, STATUSES, byStatus, type Task } from './data'

// 세 안이 같이 쓰는 조각: 조작 한 줄(명세 3절 1), 카드 '⋯'(3절 4), 얼굴(3절 3·5), '+ 업무 추가'(3절 2), 휴대폰 상태 탭.
// 생김새가 갈리는 크기·색은 안이 className으로 넘긴다.

// ── 얼굴: 중립 회색 원 + 머리글자(3절 5). 이름은 title·화면 읽기 이름으로 ──
export function Face({ name, className }: { name: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted-strong font-semibold tracking-tight text-fg-secondary',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

// ── 카드 '⋯': 넓은 화면은 카드에 마우스를 올리거나 초점이 있을 때만 보인다(group/card). 휴대폰은 늘 보인다 ──
export function CardMenu({ title, className }: { title: string; className?: string }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          data-card-menu
          variant="ghost"
          size="icon"
          touch
          aria-label={`${title} 더 보기`}
          className={cn(
            'relative z-10 shrink-0 text-fg-tertiary lg:opacity-0 lg:group-hover/card:opacity-100 lg:group-focus-within/card:opacity-100 lg:focus-visible:opacity-100 data-[state=open]:opacity-100',
            className,
          )}
        >
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>링크 복사</MenuItem>
        <MenuItem destructive>지우기</MenuItem>
      </MenuContent>
    </Menu>
  )
}

// 카드 전체를 누르는 곳으로: 제목 단추를 카드 크기로 늘린다(지금 TaskCard와 같은 방법).
export const STRETCH = 'after:absolute after:inset-0 after:content-[""] focus-visible:ring-0'

// ── '+ 업무 추가': 할 일 열 맨 아래. 열면 그 자리에 제목 한 칸 ──
export function AddTask({
  open,
  closedClass,
  openClass,
}: {
  open: boolean
  closedClass?: string
  openClass?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open)
    return (
      <Button
        data-add-task
        variant="ghost"
        className={cn('w-full justify-start gap-1.5 text-fg-tertiary', closedClass)}
      >
        <Plus aria-hidden />
        업무 추가
      </Button>
    )
  return (
    <form
      data-add-task
      className={cn('flex flex-col gap-2', openClass)}
      onSubmit={e => e.preventDefault()}
    >
      <Input ref={ref} aria-label="업무 이름" className="bg-white" />
      <div className="flex items-center gap-2">
        <Button size="sm" type="submit">
          추가
        </Button>
        <Button size="sm" variant="ghost" type="button">
          닫기
        </Button>
      </div>
    </form>
  )
}

// ── 조작 한 줄(3절 1) ──
// 왼쪽: 거르기 칩(지남·담당자 없음·마감 없음·부서) + 담당자 고르기 + 전체/내 업무. 오른쪽: 정렬 + 보기 전환.
// depts: 'chips' = 부서 칩을 늘어놓고 넘치면 칩 칸만 가로로 넘김, 'menu' = 부서를 '부서' 고르기 하나로 접음.
const CHIP = 'h-8 shrink-0 rounded-full px-3 text-xs font-medium'
// 넘김 칸 오른쪽 끝을 흐리게: 넘치면 칩이 잘린 게 아니라 이어진다는 표시. 안 넘치면 끝 여백(pr-6)만 흐려져 보이지 않는다.
const FADE_END =
  '[scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]'

function FilterChips({ tasks, depts }: { tasks: Task[]; depts: 'chips' | 'menu' }) {
  const counts = chipCounts(tasks)
  return (
    <>
      {counts.overdue > 0 && (
        <Button
          data-overdue
          variant="outline"
          className={cn(CHIP, 'border-danger-border-strong text-danger hover:bg-danger-surface')}
        >
          지남 <span className="tabular-nums">{counts.overdue}</span>
        </Button>
      )}
      <Button variant="outline" className={CHIP}>
        담당자 없음 <span className="tabular-nums">{counts.unassigned}</span>
      </Button>
      {counts.noDue > 0 && (
        <Button variant="outline" className={CHIP}>
          마감 없음 <span className="tabular-nums">{counts.noDue}</span>
        </Button>
      )}
      {depts === 'chips' ? (
        counts.depts.map(dept => (
          <Button key={dept.key} variant="outline" className={CHIP}>
            {dept.name}
          </Button>
        ))
      ) : (
        <Button variant="outline" className={cn(CHIP, 'gap-1')}>
          부서
          <ChevronDown aria-hidden className="-mr-1" />
        </Button>
      )}
    </>
  )
}

function Scope() {
  return (
    <div
      role="group"
      aria-label="보드 업무 범위"
      className="flex shrink-0 rounded-md border bg-white p-0.5"
    >
      <Button
        variant="ghost"
        size="sm"
        className="bg-surface-muted text-fg-secondary max-sm:min-h-10"
      >
        전체 업무
      </Button>
      <Button variant="ghost" size="sm" className="max-sm:min-h-10">
        내 업무
      </Button>
    </div>
  )
}

function Assignee({ className }: { className?: string }) {
  return (
    <NativeSelect
      aria-label="담당자"
      className={cn('h-8 w-32 shrink-0 bg-white py-0 text-sm', className)}
    >
      <option>담당자 전체</option>
    </NativeSelect>
  )
}

const VIEWS = [
  { label: '보드', icon: Columns3 },
  { label: '표', icon: Table2 },
  { label: '달력', icon: CalendarDays },
]

function ViewSwitch({ labels }: { labels: boolean }) {
  return (
    <div
      role="group"
      aria-label="보기 모양"
      className="flex shrink-0 rounded-md border bg-white p-0.5"
    >
      {VIEWS.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant="ghost"
          size="sm"
          aria-label={labels ? undefined : label}
          title={label}
          aria-pressed={label === '보드'}
          className={cn(
            'py-1 max-sm:min-h-10 max-sm:min-w-10',
            label === '보드' && 'bg-surface-muted text-fg-secondary',
          )}
        >
          <Icon aria-hidden />
          {labels && <span className="max-2xl:sr-only">{label}</span>}
        </Button>
      ))}
    </div>
  )
}

function Sort({ compact }: { compact: boolean }) {
  if (compact)
    return (
      <Button variant="outline" size="icon" touch aria-label="정렬 부서별" className="bg-white">
        <ArrowUpDown />
      </Button>
    )
  return (
    <NativeSelect aria-label="정렬" className="h-8 w-28 shrink-0 bg-white py-0 text-sm">
      <option>부서별</option>
    </NativeSelect>
  )
}

export function Toolbar({
  tasks,
  depts,
  className,
}: {
  tasks: Task[]
  depts: 'chips' | 'menu'
  className?: string
}) {
  return (
    <div data-toolbar className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        <div
          data-chip-scroll
          className={cn('flex min-w-0 items-center gap-1.5 overflow-x-auto pr-6', FADE_END)}
        >
          <FilterChips tasks={tasks} depts={depts} />
        </div>
        <Assignee />
        <Scope />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Sort compact={false} />
        <ViewSwitch labels />
      </div>
    </div>
  )
}

// 휴대폰 조작 한 줄: 범위·담당자·칩은 가로로 넘기고, 정렬·보기는 오른쪽에 둔다.
export function MobileToolbar({ tasks }: { tasks: Task[] }) {
  return (
    <div data-toolbar className="flex min-w-0 items-center gap-2">
      <div
        data-chip-scroll
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-6 [&_button]:min-h-11 [&_select]:min-h-11',
          FADE_END,
        )}
      >
        <Scope />
        <Assignee className="h-11 w-32" />
        <FilterChips tasks={tasks} depts="chips" />
      </div>
      <Sort compact />
    </div>
  )
}

// ── 휴대폰: 상태 탭 셋 '할 일 N · 진행 중 N · 끝남 N'과 할 일 목록(DEC-94) ──
export function MobileTabs({ tasks }: { tasks: Task[] }) {
  return (
    <div role="tablist" aria-label="업무 상태" className="flex border-b">
      {STATUSES.map(status => (
        <TabButton
          key={status}
          aria-selected={status === 'todo'}
          className="min-h-11 flex-1 justify-center gap-1 px-2"
        >
          {STATUS_LABEL[status]}{' '}
          <span className="tabular-nums">{byStatus(tasks, status).length}</span>
        </TabButton>
      ))}
    </div>
  )
}

export function MobileShell({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <MobileToolbar tasks={tasks} />
      <MobileTabs tasks={tasks} />
      <div className="mt-2">{children}</div>
    </div>
  )
}
