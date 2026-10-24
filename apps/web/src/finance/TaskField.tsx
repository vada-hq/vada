import { useTasks } from '@/tasks/useTasks'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import type { Choice } from '@/tasks/task-form-options'

type Props = {
  councilId: string
  value: Choice | null
  disabled: boolean
  onChange: (task: Choice | null) => void
  onForbidden: () => void
}

const NO_TASK_LABEL = '업무 없음'

// 요청을 이을 업무를 고르는 칸. 내 끝나지 않은 업무 가운데 서버가 준 actions에 상태 바꾸기가 있는 것만 나온다(화면이 다시 세지 않는다).
export function TaskField({ councilId, value, disabled, onChange, onForbidden }: Props) {
  const tasks = useTasks(councilId, { view: 'mine', filter: 'open' }, onForbidden)
  const ready = tasks.state.kind === 'ready'
  const listed = tasks.state.kind === 'ready' ? tasks.state.tasks : []
  const choices: Choice[] = listed
    .filter(task => task.actions.includes('task.change_status'))
    .map(task => ({ id: task.id, label: task.title }))
  // 다시 읽다가 고른 업무가 목록에서 빠져도 고른 채로 보인다. 서버가 보낼 때 409로 가른다.
  const missing = value !== null && !choices.some(item => item.id === value.id)
  return (
    <ChoiceSelect
      label="업무"
      optional
      choices={[{ id: null, label: NO_TASK_LABEL }, ...choices, ...(missing ? [value] : [])]}
      value={value?.id ?? null}
      disabled={disabled || !ready}
      onChange={id => onChange(choices.find(item => item.id === id) ?? (missing ? value : null))}
    />
  )
}
