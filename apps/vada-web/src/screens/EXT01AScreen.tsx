import type { ScopeDraft } from '../state/scopes'
import { AttendanceCheckInView } from './attendance-check-in/AttendanceCheckInView'
import { useAttendanceCheckIn } from './attendance-check-in/useAttendanceCheckIn'

interface EXT01AScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EXT01AScreen(props: EXT01AScreenProps) {
  const model = useAttendanceCheckIn(props)
  return <AttendanceCheckInView model={model} />
}
