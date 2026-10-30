import type { ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { SidePanelBody, SidePanelFooter } from '@/components/ui/side-panel'
import {
  TIME_CHECK,
  useFormCheck,
  withContract,
  type FieldErrors,
  type Parsed,
} from '@/lib/use-form-check'
import { eventFieldErrors, type EventFieldValues } from './event-fields'

type Props = {
  label: string
  submitLabel: string
  values: EventFieldValues
  // 만들기는 대화상자, 고치기는 오른쪽 패널이다. 패널은 칸이 스크롤되고 버튼 줄이 아래에 붙는다.
  layout: 'dialog' | 'panel'
  // 계약의 판단. 칸 확인이 다루지 않는 문제(너무 긴 이름과 장소)를 칸 아래에 보인다.
  parsed: Parsed
  saving: boolean
  problem: string | null
  onSubmit: () => void
  onCancel: () => void
  // 칸들. 누른 뒤의 문제(칸 이름 → 글)를 받아 칸 아래에 보인다.
  children: (errors: FieldErrors) => ReactNode
}

const EVENT_CONTRACT_MESSAGES = { startsAt: TIME_CHECK, endsAt: TIME_CHECK }

// 행사 만들기·고치기 폼. 버튼은 끄지 않고 누를 때 확인한다. 보내는 동안 모든 칸과 버튼을 막는다.
export function EventForm(props: Props) {
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(eventFieldErrors(props.values), props.parsed, EVENT_CONTRACT_MESSAGES),
  )
  // 저장 실패 이유는 버튼 줄 바로 위에 둔다. 패널은 칸이 스크롤되므로 칸 끝에 두면 누른 자리에서 보이지 않는다.
  const problem = props.problem && (
    <StateMessage kind="error" className="w-full">
      {props.problem}
    </StateMessage>
  )
  const buttons = (
    <>
      <Button type="button" variant="outline" busy={props.saving} onClick={props.onCancel}>
        닫기
      </Button>
      <Button type="submit" busy={props.saving}>
        {props.submitLabel}
      </Button>
    </>
  )
  const panel = props.layout === 'panel'
  return (
    <form
      ref={formRef}
      noValidate
      aria-label={props.label}
      className={panel ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-col gap-4'}
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) props.onSubmit()
      }}
    >
      {panel ? (
        <>
          <SidePanelBody>{props.children(errors)}</SidePanelBody>
          <SidePanelFooter>
            {problem}
            {buttons}
          </SidePanelFooter>
        </>
      ) : (
        <>
          {props.children(errors)}
          {problem}
          <DialogFooter>{buttons}</DialogFooter>
        </>
      )}
    </form>
  )
}
