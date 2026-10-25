import { useRef } from 'react'
import type { EventSummary, RegistrationFormsResponse } from '@vada/contracts'
import { KkirukLine } from '@/components/KkirukLine'
import { SidePanel, SidePanelContent } from '@/components/ui/side-panel'
import type { PolledState } from '@/lib/use-polled-read'
import type { EventFieldValues } from './event-fields'
import { EventEditFacts } from './EventEditFacts'
import { EventEditFields, type EventFieldFocus } from './EventFields'
import { EventForm } from './EventForm'

type Props = {
  values: EventFieldValues
  onValues: (values: EventFieldValues) => void
  owner: EventSummary['owner']
  forms: PolledState<RegistrationFormsResponse>
  // 열면서 포커스를 둘 칸. 없으면 이름 칸이다.
  focus?: EventFieldFocus | undefined
  valid: boolean
  saving: boolean
  problem: string | null
  onSubmit: () => void
  onClose: () => void
  onOpenForms: () => void
}

// 행사 기본정보 수정 패널의 모양(와이어프레임 EVT-02B): 머리의 끼룩이 한 줄, 고치는 구역 셋, 읽기만 하는 구역 둘, 아래 버튼 줄.
// 보내는 동안에는 닫지 못한다(Esc, 뒤로 가기, 닫기 모두).
export function EventEditPanel({ focus, saving, onClose, ...props }: Props) {
  const content = useRef<HTMLDivElement>(null)
  return (
    <SidePanel
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <SidePanelContent
        ref={content}
        title="행사 기본정보 수정"
        description={<KkirukLine>저장하면 끼룩이가 신청 화면에도 함께 반영해요</KkirukLine>}
        // 닫기(×)보다 고칠 칸에 먼저 포커스를 둔다. autoFocus를 쓰면 연 버튼을 기억하기 전에 포커스가 옮겨 닫을 때 돌아가지 못한다.
        onOpenAutoFocus={event => {
          event.preventDefault()
          content.current?.querySelector<HTMLElement>(`[name="${focus ?? 'name'}"]`)?.focus()
        }}
      >
        <EventForm
          label="행사 기본정보 수정"
          submitLabel="저장"
          values={props.values}
          layout="panel"
          valid={props.valid}
          saving={saving}
          problem={props.problem}
          onSubmit={props.onSubmit}
          onCancel={onClose}
        >
          {errors => (
            <>
              <EventEditFields
                values={props.values}
                disabled={saving}
                onChange={props.onValues}
                errors={errors}
              />
              <EventEditFacts
                forms={props.forms}
                owner={props.owner}
                busy={saving}
                onOpenForms={props.onOpenForms}
              />
            </>
          )}
        </EventForm>
      </SidePanelContent>
    </SidePanel>
  )
}
