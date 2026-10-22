import { useRef, type RefObject } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { cn } from '@/lib/utils'
import type { ScanOutcome } from './check-in'
import { ScanResultCard } from './ScanResultCard'
import { useCameraScan, type CameraState } from './useCameraScan'
import { useScanFlow } from './useScanFlow'

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 출석이 확인됐거나 이미 출석이다(목록의 출석 표시와 양식의 출석 수를 맞춘다).
  onChecked: (registrationId: string) => void
  onClose: () => void
}

const STATUS_TEXT: Partial<Record<CameraState, string>> = {
  starting: '카메라를 켜는 중…',
  loading: 'QR 판독기를 불러오는 중…',
  ready: '참가자의 QR을 네모 안에 맞춰 주세요.',
}
const PROBLEM_TEXT: Partial<Record<CameraState, string>> = {
  denied: '카메라를 쓸 수 없어요. 브라우저 설정에서 이 사이트의 카메라 사용을 허용해 주세요.',
  unsupported: '이 브라우저에서는 카메라를 쓸 수 없어요.',
  failed: '카메라를 켜지 못했어요.',
  // 앱을 연 뒤 새로 배포했으면 옛 판독기 파일이 없어 다시 시도해도 안 된다. 새로 고치면 새 파일을 받는다.
  reader: 'QR 판독기를 불러오지 못했어요. 페이지를 새로 고친 뒤 다시 열어 주세요.',
}

// 신청자마다의 QR을 운영진이 휴대폰 카메라로 찍는다(대리 출석 막기). 찍히면 바로 출석으로 남기고,
// 결과를 보이는 동안에는 읽지 않는다. [다음]을 누르면 다시 읽는다. 카메라를 못 쓰면 목록에서 이름으로 출석한다.
export function CheckInScanner({ onClose, ...props }: Props) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent aria-describedby="check-in-description">
        <Scanner onClose={onClose} {...props} />
      </DialogContent>
    </Dialog>
  )
}

type ViewProps = {
  video: RefObject<HTMLVideoElement | null>
  // 카메라를 못 쓰면 화면 대신 이유를 보이므로 숨긴다(켜 둔 채 숨겨 다시 시도가 같은 요소를 쓴다).
  hidden: boolean
  outcome: ScanOutcome | null
  onNext: () => void
}

// 카메라 화면(정사각형)과 읽을 네모. 결과는 그 위에 겹친다.
function ScanView({ video, hidden, outcome, onNext }: ViewProps) {
  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-md bg-gray-900',
        hidden && 'hidden',
      )}
    >
      <video
        ref={video}
        playsInline
        muted
        autoPlay
        aria-label="카메라 화면"
        className="size-full object-cover"
      />
      <div aria-hidden className="absolute inset-1/5 rounded-md border-2 border-white/80" />
      {/* 결과는 카메라 화면 위에 겹친다. 판독을 멈춘 동안이라 가려도 되고, 작은 휴대폰에서도 [다음]이 화면 아래로 밀리지 않는다. */}
      {outcome && (
        <div className="absolute inset-3 flex flex-col justify-end">
          <ScanResultCard outcome={outcome} onNext={onNext} />
        </div>
      )}
    </div>
  )
}

function Scanner({ onClose, ...options }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const flow = useScanFlow(options)
  const { camera, retry } = useCameraScan(video, flow.paused, flow.onText)
  const problem = PROBLEM_TEXT[camera]
  const description = problem
    ? 'QR을 찍을 수 없으면 목록에서 이름으로 찾아 [출석]을 눌러 주세요.'
    : flow.checking
      ? '확인하는 중…'
      : STATUS_TEXT[camera]
  return (
    <>
      <DialogHeader>
        <DialogTitle>QR로 출석 확인</DialogTitle>
        <DialogDescription id="check-in-description">{description}</DialogDescription>
      </DialogHeader>
      <ScanView
        video={video}
        hidden={problem !== undefined}
        outcome={flow.outcome}
        onNext={flow.next}
      />
      {problem && (
        <div className="flex flex-col items-start gap-2">
          <Alert tone="warning">{problem}</Alert>
          <Button variant="outline" size="sm" onClick={retry}>
            다시 시도
          </Button>
        </div>
      )}
      {flow.hint && <p className="text-sm text-yellow-700">참가 신청 QR이 아니에요.</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </>
  )
}
