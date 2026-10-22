import type { RegistrationForm } from '@vada/contracts'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { CheckInScanner } from './CheckInScanner'
import { FormDialog } from './FormDialog'

export type TabDialog =
  { kind: 'create' } | { kind: 'edit'; formId: string } | { kind: 'scan' } | null

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  dialog: TabDialog
  forms: RegistrationForm[]
  onClose: () => void
  // 양식을 만들었거나 고쳤다.
  onSaved: () => void
  // 출석이 확인됐거나 이미 출석이다.
  onChecked: (registrationId: string) => void
}

// 참가 신청 탭이 여는 대화상자 셋(양식 만들기·고치기, QR 스캐너). 열린 것은 하나뿐이다.
export function TabDialogs({ dialog, forms, onClose, onSaved, onChecked, ...shared }: Props) {
  if (dialog === null) return null
  if (dialog.kind === 'scan')
    return <CheckInScanner onChecked={onChecked} onClose={onClose} {...shared} />
  if (dialog.kind === 'create') return <FormDialog onClose={onClose} onDone={onSaved} {...shared} />
  // 고치는 동안 양식이 사라졌으면(다시 읽은 목록에 없다) 열지 않는다.
  const form = forms.find(item => item.id === dialog.formId)
  return form ? <FormDialog form={form} onClose={onClose} onDone={onSaved} {...shared} /> : null
}
