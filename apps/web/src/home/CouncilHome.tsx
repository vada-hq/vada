import type { ReactNode } from 'react'
import { menuPath, type EventTab, type HomeCouncilBoard, type HomeResponse } from '@vada/contracts'
import { openEventTasks, openMenu, openRecord } from '@/lib/go-to'
import { meetingMinutesPath } from '../meetings/minutes-path'
import { navigate } from '@/lib/app-location'
import { departmentFocus } from '@/lib/org-focus'
import type { Page } from '../workspace/pages'
import EventLanesCard from './EventLanesCard'
import { CouncilHead, CouncilSplit } from './CouncilHomeLayout'
import OpsCard from './OpsCard'
import AvailableLine from './AvailableLine'
import TodoCard from './TodoCard'
import WeekCard from './WeekCard'

type Props = {
  home: HomeResponse
  board: HomeCouncilBoard
  councilId: string
  // 머리 인사의 이름(학생회 읽기의 내 이름)
  name: string
  // 알림 꺼짐 띠 자리(작업 공간의 띠가 이 자리에 그려진다)
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
}

// 오른쪽 단(③ 내가 할 일 · ⑤ 이번 주 · 사용 가능 한 줄, c35 확정). 줄은 원래 화면을 연다.
// 사용 가능은 회계 기간이 없으면(overview null) 숨긴다. 재정 담당이 없어도 금액은 사실이라 보인다(재정 담당 없음은 ①의 몫, c235 2.5).
function rightColumn({
  home,
  board,
  councilId,
  name,
  onOpenEvent,
}: Pick<Props, 'home' | 'board' | 'councilId' | 'name' | 'onOpenEvent'>) {
  const openMinutes = (meetingId: string) => navigate(meetingMinutesPath(councilId, meetingId))
  const available = home.financeSummary?.overview?.available
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
    bottomRight: available !== undefined && (
      <AvailableLine amount={available} onFinance={() => openMenu('finance', councilId)} />
    ),
  }
}

// 회장단 홈 배치 L3(notes layout-report.md '가'): 머리(날짜 + 인사) → ① 한 단 전체 → 아래 두 단(왼쪽 ② 행사, 오른쪽 ③⑤·사용 가능).
// ①이 0건이면 ① 띠 대신 머리 한 문장(calmGreeting)으로 합친다(merge).
// ②③⑤ 자리는 시연 조각 ㉯㉰에서 새 구역으로 바뀐다. 그때까지 지금 카드(행사 진행 현황, 후속 정리, 가까운 일정, 재정 요약)를 그 자리에 둔다.
export default function CouncilHome({ home, board, councilId, name, pushBand, ...open }: Props) {
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
          onAssignTasks={() =>
            openMenu('tasks', councilId, {
              tab: 'council',
              events: 'include',
              dept: 'none',
              assignee: 'none',
            })
          }
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
        {...rightColumn({ home, board, councilId, name, onOpenEvent: open.onOpenEvent })}
      />
    </div>
  )
}
