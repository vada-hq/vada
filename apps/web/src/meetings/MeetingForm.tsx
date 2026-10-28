import { useRef, useState } from 'react'
import type { CreateMeetingRequest, MeetingDetail, MeetingOptionsResponse } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useFormCheck } from '@/lib/use-form-check'
import { useUnsavedInput } from '@/lib/leave-guard'
import { useActive } from '@/lib/use-active'
import { MeetingTypeFields, MeetingBasicFields, MeetingScheduleFields } from './MeetingFormFields'
import { MeetingParticipants } from './MeetingParticipants'
import { MeetingAgendaFields } from './MeetingAgendaFields'
import {
  initialMeetingForm,
  meetingChoices,
  meetingFormErrors,
  parseMeetingForm,
  type MeetingFormValue,
} from './meeting-form'
import { MEETING_OPTIONS_FAILED } from './meeting-text'
import { useMeetingOptions, type ReadMeetingOptions } from './use-meeting-options'

type Props = {
  memberId: string
  creatorName: string
  item?: MeetingDetail | undefined
  initialOptions?: MeetingOptionsResponse | undefined
  readOptions: ReadMeetingOptions
  onSave: (value: CreateMeetingRequest) => Promise<string | null>
  onClose: () => void
  onSaved: () => void
}
function useMeetingForm(props: Props) {
  const creatorId = props.item ? (props.item.createdBy?.id ?? null) : props.memberId
  const [value, setValue] = useState(() => {
    const initial = initialMeetingForm(props.memberId, props.item)
    if (!props.item && props.initialOptions)
      initial.attendeeIds = [
        ...new Set([...props.initialOptions.defaultAttendeeIds, props.memberId]),
      ]
    return initial
  })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const active = useActive()
  const release = useUnsavedInput(dirty)
  const check = useFormCheck(() => meetingFormErrors(value, creatorId))
  const options = useMeetingOptions({
    value,
    creatorId,
    editing: Boolean(props.item),
    read: props.readOptions,
    initial: props.initialOptions,
    setAttendees: ids => setValue(before => ({ ...before, attendeeIds: ids })),
  })
  const change = (patch: Partial<MeetingFormValue>) => {
    if (patch.attendeeIds) options.markModified()
    // 시각을 고치면 다음 날 끝나던 회의도 그 날짜 안의 회의로 다시 본다.
    const retimed = 'start' in patch || 'end' in patch
    setValue(before => ({ ...before, ...patch, ...(retimed ? { endDayOffset: 0 } : {}) }))
    setDirty(true)
    setError(null)
  }
  const save = async () => {
    if (sending.current || !check.attempt()) return
    if (options.loading || options.failed) {
      setError(MEETING_OPTIONS_FAILED)
      return
    }
    const parsed = parseMeetingForm(value, creatorId)
    if (!parsed.success) return
    sending.current = true
    setBusy(true)
    const problem = await props.onSave(parsed.data)
    sending.current = false
    if (!active()) return
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    release()
    setDirty(false)
    props.onSaved()
  }
  return {
    fields: { value, errors: check.errors, onChange: change },
    options,
    busy,
    error,
    save,
    formRef: check.formRef,
    creatorId,
  }
}
export function MeetingForm(props: Props) {
  const { fields, options, busy, error, save, formRef, creatorId } = useMeetingForm(props)
  const title = props.item ? '회의 고치기' : '새 회의'
  const choices = meetingChoices(options.data, props.item)
  return (
    <>
      <PageHeading trail={{ title, crumbs: [{ label: title, truncate: false }] }}>
        <h1 className="text-xl font-semibold">{title}</h1>
      </PageHeading>
      <form
        ref={formRef}
        noValidate
        className="flex min-w-0 flex-col gap-5"
        onSubmit={event => {
          event.preventDefault()
          void save()
        }}
      >
        {options.loading && <StateMessage kind="loading">선택지 불러오는 중…</StateMessage>}
        {options.failed && (
          <div className="flex flex-col items-start gap-3">
            <StateMessage kind="error">{MEETING_OPTIONS_FAILED}</StateMessage>
            <Button type="button" variant="outline" touch onClick={options.reload}>
              다시 시도
            </Button>
          </div>
        )}
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
          <MeetingTypeFields {...fields} options={choices} />
          <MeetingBasicFields {...fields} options={choices} creatorName={props.creatorName} />
          <MeetingScheduleFields {...fields} />
          <MeetingParticipants {...fields} options={choices} creatorId={creatorId} />
          {!props.item && <MeetingAgendaFields {...fields} />}
        </fieldset>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" touch busy={busy} onClick={props.onClose}>
            닫기
          </Button>
          <Button touch busy={busy}>
            {props.item ? '저장' : '만들기'}
          </Button>
        </div>
      </form>
    </>
  )
}
