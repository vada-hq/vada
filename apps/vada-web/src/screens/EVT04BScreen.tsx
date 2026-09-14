import { AttendanceQrModal } from './attendance-qr/AttendanceQrModal'
import { useAttendanceQr } from './attendance-qr/useAttendanceQr'

interface EVT04BScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT04BScreen({ screenParams, onNavigate }: EVT04BScreenProps) {
  const model = useAttendanceQr(screenParams, onNavigate)
  return <AttendanceQrModal model={model} screenParams={screenParams} />
}
