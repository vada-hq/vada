import type { ApplicantChange } from '@vada/contracts'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { CheckInScanner } from './CheckInScanner'

// 탭이 여는 것. 양식 만들기·고치기는 탭 안의 화면(FormEditor)이고, QR 스캐너만 대화상자다. 열린 것은 하나뿐이다.
export type TabDialog =
  { kind: 'create' } | { kind: 'edit'; formId: string } | { kind: 'scan' } | null

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  dialog: TabDialog
  onClose: () => void
  // 출석이 확인됐거나 이미 출석이다.
  onChecked: (applicant: ApplicantChange) => void
}

// 참가 신청 탭의 대화상자(QR 스캐너).
export function TabDialogs({ dialog, onClose, onChecked, ...shared }: Props) {
  if (dialog?.kind !== 'scan') return null
  return <CheckInScanner onChecked={onChecked} onClose={onClose} {...shared} />
}
