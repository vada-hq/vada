import { useState } from 'react'
import type { TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { TASK_TEAM_FAILED } from '@/lib/messages'
import { useTeam } from '@/team/useTeam'
import { choiceId, choiceValue, type Choice } from './task-form-options'

type Props = {
  label: string
  councilId: string
  // 지금 값을 보이는 글
  current: string
  currentId: string | null
  canChange: boolean
  saving: boolean
  problem: string | undefined
  choicesOf: (team: TeamResponse) => Choice[]
  onForbidden: () => void
  // 성공하면 true. 성공하면 고르는 칸이 닫힌다.
  onSave: (id: string | null) => Promise<boolean>
}

const UNSET = '__current__'

// 부서나 담당자 한 줄: 지금 값과 [바꾸기]. 누르면 선택지를 읽어 고르는 칸이 열린다.
export function TaskPickerRow(props: Props) {
  const [picking, setPicking] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="wrap-anywhere">{props.current}</span>
        {props.canChange && !picking && (
          <Button
            size="sm"
            variant="outline"
            aria-label={`${props.label} 바꾸기`}
            onClick={() => setPicking(true)}
          >
            바꾸기
          </Button>
        )}
      </div>
      {props.canChange && picking && <Picker {...props} onDone={() => setPicking(false)} />}
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
    </div>
  )
}

function Picker({ onDone, ...props }: Props & { onDone: () => void }) {
  const team = useTeam(props.councilId, props.onForbidden)
  const choices = team.data ? props.choicesOf(team.data) : []
  // 지금 값이 선택지에 없으면(떠난 담당자) 어느 것도 고르지 않은 채 시작한다. 아니면 첫 항목이 골라진 것처럼 보여 고를 수 없다.
  const listed = choices.some(item => item.id === props.currentId)
  const [picked, setPicked] = useState<string | null>(null)
  const value = picked ?? (listed ? choiceValue(props.currentId) : UNSET)
  if (team.loadFailed) return <StateMessage kind="error">{TASK_TEAM_FAILED}</StateMessage>
  if (!team.data) return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label={props.label}
        className="w-auto max-w-full flex-1"
        value={value}
        disabled={props.saving}
        onChange={event => setPicked(event.target.value)}
      >
        {!listed && (
          <option value={UNSET} disabled>
            {props.current}
          </option>
        )}
        {choices.map(item => (
          <option key={choiceValue(item.id)} value={choiceValue(item.id)}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        size="sm"
        disabled={props.saving || value === UNSET || value === choiceValue(props.currentId)}
        onClick={() => {
          void props.onSave(choiceId(value)).then(done => {
            if (done) onDone()
          })
        }}
      >
        저장
      </Button>
      <Button size="sm" variant="outline" disabled={props.saving} onClick={onDone}>
        취소
      </Button>
    </div>
  )
}
