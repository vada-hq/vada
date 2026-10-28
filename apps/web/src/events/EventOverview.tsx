import type { EventDetail } from '@vada/contracts'
import type { EventTab } from './event-view'
import type { EventFieldFocus } from './EventFields'
import { OverviewAttention } from './OverviewAttention'
import { OverviewNumbers } from './OverviewNumbers'
import { OverviewSetup } from './OverviewSetup'
import { OverviewTasks } from './OverviewTasks'
import { attentionOf, isBlank, setupSteps } from './overview-view'
import type { EventDialogHandlers } from './useEventSubmit'
import { useEventOverview } from './useEventOverview'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  // 다른 탭으로 옮긴다(카드의 '업무 보기', '구매 보기').
  onTab: (tab: EventTab) => void
  // 업무 하나를 눌렀다. 업무 탭에서 그 업무를 연다.
  onOpenTask: (taskId: string) => void
  // 챙길 것의 '담당자 없음'. 업무 탭을 담당자 없는 업무만 보이는 보기로 연다.
  onOpenUnassigned: () => void
  // 준비 단계의 '업무 만들기'. 업무 탭에서 만들기를 연 채 시작한다.
  onCreateTask: () => void
  // 준비 단계의 '일시 넣기'. 머리의 고치기를 그 칸에 포커스를 두고 연다.
  onEdit: (focus: EventFieldFocus) => void
}

type Data = ReturnType<typeof useEventOverview>

// 준비 단계마다 그 일을 바로 하는 길. 권한이 없으면 링크를 두지 않는다(DEC-38).
function setupActions(event: EventDetail, data: Data, props: Props) {
  const manageForms = data.forms.kind === 'ready' && data.forms.data.actions.includes('form.create')
  return {
    ...(event.actions.includes('event.update') && {
      when: {
        label: event.startsAt === null ? '일시 넣기' : '장소 넣기',
        run: () => props.onEdit(event.startsAt === null ? 'startsAt' : 'place'),
      },
    }),
    tasks: { label: '업무 만들기', run: props.onCreateTask },
    budget: { label: '구매 보기', run: () => props.onTab('money') },
    ...(manageForms && {
      registration: { label: '신청 양식 만들기', run: () => props.onTab('registrations') },
    }),
  }
}

// 업무·신청·돈을 다 읽었을 때만 준비 단계를 센다. 읽는 동안 단계가 깜빡이지 않게 한다.
function setupOf(event: EventDetail, data: Data) {
  if (data.forms.kind !== 'ready' || data.settlement.kind !== 'ready') return null
  const forms = data.forms.data.forms
  const { settlement } = data.settlement.data
  return { steps: setupSteps(event, forms, settlement), blank: isBlank(event, forms, settlement) }
}

// 일이 시작된 행사의 수 카드와 다음 업무. 아무것도 없는 새 행사에는 그리지 않는다(빈 카드를 늘어놓지 않는다).
function Progress({
  event,
  data,
  onTab,
  onOpenTask,
}: Pick<Props, 'event' | 'onTab' | 'onOpenTask'> & { data: Data }) {
  return (
    <>
      <OverviewNumbers
        tasks={event.tasks}
        forms={data.forms}
        settlement={data.settlement}
        onTab={onTab}
      />
      <OverviewTasks
        tasks={data.tasks.kind === 'ready' ? data.tasks.tasks : null}
        failed={data.tasks.kind === 'failed'}
        onOpenTask={onOpenTask}
      />
    </>
  )
}

// 개요 탭: 이 행사가 어디까지 왔고 무엇이 막혔는지(navigation.md 요구 11 '행사의 일정과 담당 보기').
// 챙길 것 → 준비 단계(새 행사) → 세 탭의 수 → 다음 업무 순이다(와이어프레임 Event Overview).
// 아무것도 없는 새 행사는 빈 수 카드를 늘어놓지 않고 준비 단계만 보인다.
export function EventOverview(props: Props) {
  const {
    councilId,
    event,
    onTab,
    onOpenTask,
    onOpenUnassigned,
    onCreateTask: _c,
    onEdit: _e,
    ...handlers
  } = props
  const data = useEventOverview(councilId, event.id, handlers)
  const openTasks = data.tasks.kind === 'ready' ? data.tasks.tasks : []
  const settlement = data.settlement.kind === 'ready' ? data.settlement.data.settlement : null
  const setup = setupOf(event, data)
  return (
    <div className="flex flex-col gap-6">
      <OverviewAttention
        items={attentionOf(event, openTasks, settlement)}
        onTab={onTab}
        onUnassigned={onOpenUnassigned}
      />
      {setup?.steps && (
        <OverviewSetup steps={setup.steps} actions={setupActions(event, data, props)} />
      )}
      {!setup?.blank && (
        <Progress event={event} data={data} onTab={onTab} onOpenTask={onOpenTask} />
      )}
    </div>
  )
}
