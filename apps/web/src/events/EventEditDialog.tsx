import { useState } from 'react'
import { UpdateEventSchema, type EventDetail } from '@vada/contracts'
import { openEventTab } from '@/lib/go-to'
import { useRegistrationForms } from '../registrations/useRegistrationForms'
import { eventFieldsOf, eventFieldsRequest } from './event-fields'
import { eventPath } from './event-api'
import { EventEditPanel } from './EventEditPanel'
import type { EventFieldFocus } from './EventFields'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  onClose: () => void
  onDone: (event: EventDetail) => void
  focus?: EventFieldFocus | undefined
}

// 행사 기본정보 수정(오른쪽 패널): 이름, 일시, 장소를 고치고 참여 정보(신청 양식의 참가비·정원)를 읽기만 한다.
// 양식 목록은 신청자 정보가 없어 읽어도 열람 기록이 남지 않는다.
export function EventEditDialog({ councilId, event, onClose, onDone, focus, ...handlers }: Props) {
  const [values, setValues] = useState(() => eventFieldsOf(event, focus))
  const [saving, setSaving] = useState(false)
  const forms = useRegistrationForms(councilId, event.id, handlers)
  const submit = useEventSubmit(
    eventPath(councilId, event.id),
    UpdateEventSchema,
    eventFieldsRequest(values),
    { ...handlers, onDone, setSaving },
  )
  return (
    <EventEditPanel
      values={values}
      onValues={setValues}
      owner={event.owner}
      forms={forms.state}
      focus={focus}
      valid={submit.valid}
      saving={saving}
      problem={submit.problem}
      onSubmit={() => void submit.submit()}
      onClose={onClose}
      onOpenForms={() => {
        onClose()
        openEventTab(councilId, event.id, 'registrations')
      }}
    />
  )
}
