import { useEvents } from '@/events/useEvents'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { eventChoices } from '@/tasks/task-form-options'

type Props = {
  councilId: string
  value: string | null
  disabled: boolean
  // 결제한 요청의 행사로 정해진 칸이면 바꿀 수 없다.
  locked?: boolean
  onChange: (eventId: string | null) => void
  onForbidden: () => void
}

// 요청·예산 항목·지출을 행사에 잇는 칸. 없음과 완료하지 않은 행사만 고른다(완료한 행사는 서버가 409로 막는다).
export function EventField({
  councilId,
  value,
  disabled,
  locked = false,
  onChange,
  onForbidden,
}: Props) {
  const events = useEvents(councilId, onForbidden)
  const ready = events.state.kind === 'ready'
  const all = events.state.kind === 'ready' ? events.state.data.events : []
  const open = all.filter(item => item.status !== 'completed')
  const current = all.find(item => item.id === value) ?? null
  return (
    <ChoiceSelect
      label="행사"
      optional
      choices={eventChoices(open, current)}
      value={value}
      disabled={disabled || locked || !ready}
      onChange={onChange}
    />
  )
}
