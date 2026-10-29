import { CircleDashed, Clock, UserCheck, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { HomeEventLane, HomeEventMilestone } from '@vada/contracts'
import { wonLabel } from '../finance/purchase-view'
import { COUNCIL_TASK_LABEL } from '../tasks/task-view'
import { greetingDate } from './home-time'

// ② 행사(e6)의 글. 고르기·차례·신호는 서버가 정했고 여기는 글과 누를 곳만 만든다.
export const LANES_TITLE = '행사'
export const LANES_EMPTY = '진행 중인 행사 없음'
export const NO_MILESTONE_TEXT = '일정 미정'

const MILESTONE_NAME: Record<HomeEventMilestone, string> = {
  registration_open: '신청 시작',
  registration_close: '신청 마감',
  event_start: '행사 시작',
  event_end: '행사 종료',
}

// 다음 일정 글: { dday: 'D-2' | '오늘', name: '신청 마감', dateText: '10월 30일 (금)' }. 없으면 null(일정 미정).
export function milestoneText(lane: HomeEventLane) {
  const { milestone } = lane
  if (!milestone) return null
  return {
    dday: milestone.days === 0 ? '오늘' : `D-${milestone.days}`,
    name: MILESTONE_NAME[milestone.kind],
    dateText: greetingDate(milestone.date),
  }
}

// 신호 하나. 차례는 신청 → 미정 → 늦은 부서 → 예산(내용 표 차례). 위험 색은 지남·예산 초과만.
export type LaneSignal = {
  key: string
  icon: LucideIcon
  // 화면 읽기 앞말('18/40'만으로는 무엇인지 모름)
  label: string
  text: string
  tone: 'neutral' | 'strong' | 'danger'
  target:
    | { kind: 'registrations' }
    | { kind: 'overview' }
    | { kind: 'late'; departmentId: string | null }
    | { kind: 'money' }
}

function registrationSignal(registration: NonNullable<HomeEventLane['registration']>): LaneSignal {
  const { count, capacity, full } = registration
  const text = capacity === null ? `${count}명` : `${count}/${capacity}${full ? ' 마감' : ''}`
  return {
    key: 'registration',
    icon: full ? UserCheck : Users,
    label: '신청 ',
    text,
    tone: full ? 'strong' : 'neutral',
    target: { kind: 'registrations' },
  }
}

function budgetSignal(budget: NonNullable<HomeEventLane['budget']>): LaneSignal {
  const over = budget.kind === 'over'
  return {
    key: 'budget',
    icon: Wallet,
    label: '',
    text: over ? `예산 ${wonLabel(budget.amount)} 초과` : '예산 미정',
    tone: over ? 'danger' : 'neutral',
    target: { kind: 'money' },
  }
}

export function signalsOf(lane: HomeEventLane): LaneSignal[] {
  return [
    ...(lane.registration ? [registrationSignal(lane.registration)] : []),
    ...lane.undecided.map((field): LaneSignal => ({
      key: field,
      icon: CircleDashed,
      label: '',
      text: '장소 미정',
      tone: 'neutral',
      target: { kind: 'overview' },
    })),
    ...lane.late.map(({ department, overdue }): LaneSignal => ({
      key: `late-${department?.id ?? 'none'}`,
      icon: Clock,
      label: '',
      text: `${department?.name ?? COUNCIL_TASK_LABEL} 지남 ${overdue}`,
      tone: 'danger',
      target: { kind: 'late', departmentId: department?.id ?? null },
    })),
    ...(lane.budget ? [budgetSignal(lane.budget)] : []),
  ]
}
