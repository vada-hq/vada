import type { ReactNode } from 'react'
import type { EventDetail, RegistrationFormsResponse, SettlementResponse } from '@vada/contracts'
import { Meter } from '@/components/Meter'
import { NumberCard } from '@/components/NumberCard'
import type { PolledState } from '@/lib/use-polled-read'
import { wonLabel } from '../finance/purchase-view'
import type { EventTab } from './event-view'
import { OverviewLink } from './OverviewLink'
import { registrationTotals } from './overview-view'

const LOADING = '불러오는 중이에요'
const FAILED = '읽지 못했어요'

function TasksNumber({ tasks, link }: { tasks: EventDetail['tasks']; link: ReactNode }) {
  if (tasks.total === 0)
    return <NumberCard label="업무" link={link} value={null} sub="아직 업무가 없어요" />
  const done = tasks.total - tasks.open
  return (
    <NumberCard
      label="업무"
      link={link}
      value={`${done}/${tasks.total}`}
      sub={tasks.open === 0 ? '모두 끝났어요' : `끝난 업무 · 남은 것 ${tasks.open}개`}
    >
      <Meter className="mt-1" value={done} max={tasks.total} label="끝난 업무" />
    </NumberCard>
  )
}

function RegistrationNumber({
  state,
  link,
}: {
  state: PolledState<RegistrationFormsResponse>
  link: ReactNode
}) {
  const card = (value: string | null, sub: string) => (
    <NumberCard label="참가 신청" link={link} value={value} sub={sub} />
  )
  if (state.kind !== 'ready') return card(null, state.kind === 'loading' ? LOADING : FAILED)
  if (state.data.forms.length === 0) return card(null, '신청 양식 없음')
  const total = registrationTotals(state.data.forms)
  const capacity = total.capacity === null ? '' : `정원 ${total.capacity}명 · `
  return card(`${total.applicants}명`, `${capacity}출석 ${total.attended}명`)
}

function MoneyNumber({ state, link }: { state: PolledState<SettlementResponse>; link: ReactNode }) {
  if (state.kind !== 'ready')
    return (
      <NumberCard
        label="지출"
        link={link}
        value={null}
        sub={state.kind === 'loading' ? LOADING : FAILED}
      />
    )
  const { budget, actual } = state.data.settlement
  if (budget.expense === 0 && actual.expense === 0)
    return <NumberCard label="지출" link={link} value={null} sub="지출 없음" />
  return (
    <NumberCard
      label="지출"
      link={link}
      value={wonLabel(actual.expense)}
      sub={budget.expense > 0 ? `지출 예산 ${wonLabel(budget.expense)}` : '지출 예산 없음'}
    />
  )
}

type Props = {
  tasks: EventDetail['tasks']
  forms: PolledState<RegistrationFormsResponse>
  settlement: PolledState<SettlementResponse>
  onTab: (tab: EventTab) => void
}

// 세 탭의 수: 업무 진행, 참가 신청, 지출. 카드마다 그 탭으로 가는 링크가 있다(와이어프레임 Event Overview의 수 카드, Linear 프로젝트 진행).
export function OverviewNumbers({ tasks, forms, settlement, onTab }: Props) {
  const link = (tab: EventTab, label: string) => (
    <OverviewLink onClick={() => onTab(tab)}>{label}</OverviewLink>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <TasksNumber tasks={tasks} link={link('tasks', '업무 보기')} />
      <RegistrationNumber state={forms} link={link('registrations', '신청 보기')} />
      <MoneyNumber state={settlement} link={link('money', '재정 보기')} />
    </div>
  )
}
