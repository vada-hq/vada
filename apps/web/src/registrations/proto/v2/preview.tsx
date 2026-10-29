import type { EventDetail } from '@vada/contracts'
import type { FormValues } from '../../registration-form'
import { ApplyPreview } from '../apply-preview'
import { Sheet } from './parts'
import { preview, radius, type } from './tokens'

type Props = { values: FormValues; event: EventDetail; councilName: string }

// 1280 옆 미리보기: 휴대폰 390 화면을 그대로 그리고 0.77배로 줄여 300px 틀에 넣는다(학생이 보는 줄바꿈이 그대로).
// 신청자 화면 확정안('큰 글자 앱 화면 모양')을 고치지 않고 가져다 쓴다. 틀 안에서만 스크롤한다.
export function PhonePreview(props: Props) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        className={`${preview.frameWidth} overflow-hidden ${radius.phone} bg-white ring-8 ring-surface-muted outline outline-border-default`}
      >
        <div className={`${preview.height} overflow-y-auto overscroll-contain`}>
          <div className={`${preview.innerWidth} ${preview.zoom}`}>
            <ApplyPreview {...props} />
          </div>
        </div>
      </div>
      <figcaption className={`${type.small} text-fg-muted`}>학생 화면</figcaption>
    </figure>
  )
}

// 390·카드의 [미리보기]: 시트 안에 같은 신청 화면을 실제 크기로.
export function PreviewSheet({ onClose, ...props }: Props & { onClose: () => void }) {
  return (
    <Sheet title="학생 화면 미리보기" onClose={onClose}>
      <div className="w-full sm:w-[390px]">
        <ApplyPreview {...props} />
      </div>
    </Sheet>
  )
}
