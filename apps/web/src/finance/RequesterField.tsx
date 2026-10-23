import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import type { Choice } from '@/tasks/task-form-options'

type Props = {
  // 재정부에게만 준다(없으면 칸이 없다). 첫 선택지가 나다.
  choices: Choice[] | null
  value: string | null
  disabled: boolean
  onChange: (id: string | null) => void
}

// 대신 낼 때의 요청한 사람 칸.
export function RequesterField({ choices, ...props }: Props) {
  if (choices === null) return null
  return <ChoiceSelect label="요청한 사람" choices={choices} {...props} />
}
