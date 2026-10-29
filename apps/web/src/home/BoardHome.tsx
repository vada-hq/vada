import type { ReactNode } from 'react'
import {
  menuPath,
  type AppQuery,
  type EventTab,
  type HomeCouncilBoard,
  type HomeOps,
  type HomeResponse,
} from '@vada/contracts'
import { openEventTasks, openMenu, openRecord } from '@/lib/go-to'
import { rememberDepartment } from '@/lib/menu-memory'
import { meetingMinutesPath } from '../meetings/minutes-path'
import { navigate } from '@/lib/app-location'
import { departmentFocus } from '@/lib/org-focus'
import type { Page } from '../workspace/pages'
import EventLanesCard from './EventLanesCard'
import { CouncilHead, CouncilSplit } from './CouncilHomeLayout'
import OpsCard from './OpsCard'
import TodoCard from './TodoCard'
import WeekCard from './WeekCard'

// 회장단 홈과 부장 홈이 같이 쓰는 구역 데이터(①②③⑤). 어느 역할의 데이터인지는 서버가 정했다(DEC-38).
type HomeBoardZones = Pick<HomeCouncilBoard, 'ops' | 'todo' | 'week' | 'lanes'>

type Props = {
  home: HomeResponse
  board: HomeBoardZones
  councilId: string
  // 머리 인사의 이름(학생회 읽기의 내 이름)
  name: string
  // 알림 꺼짐 띠 자리(작업 공간의 띠가 이 자리에 그려진다)
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
  // 오른쪽 단 맨 아래 돈 한 줄(회장단: 사용 가능, 부장: 우리 부서가 맡은 예산). 없으면 자리도 없다.
  money?: ReactNode
}

// 오른쪽 단(③ 내가 할 일 · ⑤ 이번 주 · 돈 한 줄, c35 확정). 줄은 원래 화면을 연다.
function rightColumn({
  board,
  councilId,
  name,
  money,
  onOpenEvent,
}: Pick<Props, 'board' | 'councilId' | 'name' | 'money' | 'onOpenEvent'>) {
  const openMinutes = (meetingId: string) => navigate(meetingMinutesPath(councilId, meetingId))
  return {
    right: [
      <TodoCard
        key="todo"
        todo={board.todo}
        name={name}
        onOpen={row => {
          if (row.kind === 'minutes') openMinutes(row.meeting.id)
          else if (row.kind === 'event_tidy')
            onOpenEvent(row.event.id, row.remaining.settlement > 0 ? 'money' : undefined)
          else openRecord('tasks', councilId, row.task.id, { behind: 'home' })
        }}
      />,
      <WeekCard
        key="week"
        week={board.week}
        onOpen={item =>
          item.kind === 'meeting'
            ? openRecord('meetings', councilId, item.meeting.id)
            : openRecord('schedule', councilId, item.item.id)
        }
        onAgenda={openMinutes}
        onSeeCalendar={() => openMenu('calendar', councilId)}
      />,
    ],
    bottomRight: money,
  }
}

// 배정할 일 줄이 여는 업무 목록. 회장단은 부서 미정(부서 없음 + 담당자 없음), 부장은 직급 부서의 담당자 없음이다.
function assignQuery(assign: HomeOps['assign']): AppQuery {
  const base = { tab: 'council', events: 'include', assignee: 'none' }
  if (assign.by === 'council') return { ...base, dept: 'none' }
  const [only, ...more] = assign.departments
  return { ...base, heads: 'true', ...(only && !more.length ? { dept: only.id } : {}) }
}

function openAssign(councilId: string, assign: HomeOps['assign']) {
  // 거르는 부서의 이름은 업무 화면의 칩이 쓴다(내 부서가 아닌 부서도 이름이 보이게).
  if (assign.by === 'head')
    for (const department of assign.departments) rememberDepartment(department.id, department.name)
  openMenu('tasks', councilId, assignQuery(assign))
}

// 홈 배치 L3(notes layout-report.md '가'): 머리(날짜 + 인사) → ① 한 단 전체 → 아래 두 단(왼쪽 ② 행사, 오른쪽 ③⑤·돈 한 줄).
// ①이 0건이면 ① 띠 대신 머리 한 문장(calmGreeting)으로 합친다(merge).
// 회장단 홈과 부장 홈이 같이 쓴다(부장 홈 = 회장단 홈 + 부장 범위의 데이터 − 회장단 전용 구역, notes dept-home-content.md).
// 구역은 역할을 모르고 받은 데이터만 그린다.
export default function BoardHome({
  home,
  board,
  councilId,
  name,
  pushBand,
  money,
  ...open
}: Props) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId, { behind: 'home' })
  const calm = board.ops.total === 0
  return (
    <div className="@container flex flex-col gap-4 @2xl:gap-6">
      {pushBand}
      <CouncilHead today={home.today} name={name} calm={calm} />
      {!calm && (
        <OpsCard
          ops={board.ops}
          onOpen={target =>
            target.kind === 'task'
              ? openTask(target.id)
              : openRecord('purchases', councilId, target.id)
          }
          onAssignTasks={() => openAssign(councilId, board.ops.assign)}
          onSeePeople={() => openMenu('people', councilId)}
          onSeeFinance={() => navigate(menuPath('people', councilId), { pageState: 'finance' })}
          onSetHead={departmentId =>
            navigate(menuPath('people', councilId), { pageState: departmentFocus(departmentId) })
          }
        />
      )}
      <CouncilSplit
        ruleAbove={!calm}
        left={
          <EventLanesCard
            lanes={board.lanes}
            today={home.today}
            onOpen={lane => open.onOpenEvent(lane.event.id)}
            onSignal={(lane, target) => {
              const id = lane.event.id
              if (target.kind === 'late')
                openEventTasks(councilId, id, {
                  dept: target.departmentId ?? 'none',
                  due: 'overdue',
                })
              else if (target.kind === 'overview') open.onOpenEvent(id)
              else open.onOpenEvent(id, target.kind)
            }}
            onSeeAll={() => open.onOpenPage('events')}
            onNewEvent={open.onNewEvent}
          />
        }
        {...rightColumn({ board, councilId, name, money, onOpenEvent: open.onOpenEvent })}
      />
    </div>
  )
}
