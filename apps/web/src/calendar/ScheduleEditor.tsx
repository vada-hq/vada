import {
  statusOf,
  type CouncilView,
  type ScheduleItemDetail,
  type ScheduleItemResponse,
  type UpdateScheduleItemRequest,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useEvents, type EventList } from '@/events/useEvents'
import { postJson } from '@/lib/api'
import { SAVE_FAILED } from '@/lib/messages'
import { SCHEDULE_DEPARTMENT_FORBIDDEN, SCHEDULE_NOT_FOUND } from '@/lib/calendar-messages'
import { useTeam, type Team } from '@/team/useTeam'
import { useActive } from '@/lib/use-active'
import { ScheduleDialog } from './ScheduleDialog'
import type { ScheduleChoice, ScheduleSaveProblem } from './schedule-form'

// 이미 연결한 항목이 더는 선택지가 아니어도 조용히 다른 값으로 보이지 않게 한다.
const withCurrent = (choices: ScheduleChoice[], current: ScheduleChoice | null | undefined) =>
  current && !choices.some(choice => choice.id === current.id)
    ? [{ ...current, disabled: true }, ...choices]
    : choices

type Props = {
  view: CouncilView
  initialDate: string
  item?: ScheduleItemDetail | undefined
  onForbidden: () => void
  onSaved: (item: ScheduleItemDetail) => void
  onMissing: () => void
  onClose: () => void
}

const openEvents = (events: EventList) =>
  events.state.kind === 'ready'
    ? events.state.data.events.filter(event => event.status !== 'completed')
    : []

function OptionsNotice({
  team,
  events,
  allDepartments,
}: {
  team: Team
  events: EventList
  allDepartments: boolean
}) {
  const failed = team.loadFailed || events.state.kind === 'failed'
  const loading = (allDepartments && !team.data) || events.state.kind === 'loading'
  if (failed)
    return (
      <div className="flex flex-col gap-2">
        <StateMessage kind="error">선택지를 불러오지 못했어요.</StateMessage>
        <Button
          type="button"
          variant="outline"
          touch
          className="self-start"
          onClick={() => {
            team.reload()
            void events.reload()
          }}
        >
          다시 시도
        </Button>
      </div>
    )
  return loading ? <StateMessage kind="loading">선택지 불러오는 중…</StateMessage> : null
}

function useScheduleOptions(
  view: CouncilView,
  item: ScheduleItemDetail | undefined,
  onForbidden: () => void,
) {
  const allDepartments = view.me.councilRank !== null
  const team = useTeam(view.council.id, onForbidden, allDepartments)
  const events = useEvents(view.council.id, onForbidden)
  const own = allDepartments ? (team.data?.departments ?? []) : view.me.departments
  return {
    departments: withCurrent(own, item?.department),
    events: withCurrent(openEvents(events), item?.event),
    optionsNotice: <OptionsNotice team={team} events={events} allDepartments={allDepartments} />,
  }
}

export function ScheduleEditor({
  view,
  initialDate,
  item,
  onForbidden,
  onSaved,
  onMissing,
  onClose,
}: Props) {
  const councilId = view.council.id
  const active = useActive()
  const options = useScheduleOptions(view, item, onForbidden)
  const save = async (body: UpdateScheduleItemRequest): Promise<ScheduleSaveProblem | null> => {
    const base = `/api/organizations/${councilId}/schedule`
    const result = await postJson<ScheduleItemResponse>(item ? `${base}/${item.id}` : base, body)
    if (!active()) return null
    if (result.ok) {
      onSaved(result.data.item)
      return null
    }
    if (result.status === statusOf('FORBIDDEN')) {
      onForbidden()
      return { departmentId: SCHEDULE_DEPARTMENT_FORBIDDEN }
    }
    if (result.status === statusOf('NOT_FOUND')) {
      onMissing()
      return { form: SCHEDULE_NOT_FOUND }
    }
    return { form: SAVE_FAILED }
  }
  return (
    <ScheduleDialog
      initialDate={initialDate}
      item={item}
      {...options}
      onSave={save}
      onClose={onClose}
    />
  )
}
