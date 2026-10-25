import type { ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { SidePanelBody, SidePanelFooter } from '@/components/ui/side-panel'
import { useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { eventFieldErrors, type EventFieldValues } from './event-fields'

type Props = {
  label: string
  submitLabel: string
  values: EventFieldValues
  // 만들기는 대화상자, 고치기는 오른쪽 패널이다. 패널은 칸이 스크롤되고 버튼 줄이 아래에 붙는다.
  layout: 'dialog' | 'panel'
  valid: boolean
  saving: boolean
  problem: string | null
  onSubmit: () => void
  onCancel: () => void
  // 칸들. 누른 뒤의 문제(칸 이름 → 글)를 받아 칸 아래에 보인다.
  children: (errors: FieldErrors) => ReactNode
}

// 행사 만들기·고치기 폼. 버튼은 끄지 않고 누를 때 확인한다. 보내는 동안 모든 칸과 버튼을 막는다.
export function EventForm(props: Props) {
  const { formRef, errors, attempt } = useFormCheck(() => eventFieldErrors(props.values))
  const body = (
    <>
      {props.children(errors)}
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
    </>
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
        if (attempt() && props.valid) props.onSubmit()
      }}
    >
      {panel ? (
        <>
          <SidePanelBody>{body}</SidePanelBody>
          <SidePanelFooter>{buttons}</SidePanelFooter>
        </>
      ) : (
        <>
          {body}
          <DialogFooter>{buttons}</DialogFooter>
        </>
      )}
    </form>
  )
}
