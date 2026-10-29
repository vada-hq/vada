import { Download } from 'lucide-react'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import { MainButton, Sheet } from './parts'
import { size } from './tokens'

// 흰 네모 안 QR(여백은 matrix에 들어 있다, QR 여백 근거). 작은 것은 속성 줄 값 자리, 큰 것은 시트.
function QrSvg({
  link,
  label,
  className,
  measure,
}: {
  link: string
  label: string
  className: string
  measure?: string
}) {
  const matrix = qrMatrix(link)
  return (
    <svg
      role="img"
      aria-label={label}
      data-measure={measure}
      viewBox={`0 0 ${matrix.length} ${matrix.length}`}
      shapeRendering="crispEdges"
      className={`${className} rounded-md bg-white`}
    >
      <path d={qrPath(matrix)} className="fill-black" />
    </svg>
  )
}

// 속성 줄의 작은 QR. 누르면 큰 QR 시트(휴대폰으로 화면을 바로 찍거나 저장).
export function PosterQr({
  link,
  name,
  onOpen,
}: {
  link: string
  name: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`${name} QR 크게 보기`}
      onClick={onOpen}
      className="cursor-pointer rounded-lg p-0.5 ring-1 ring-border-default outline-none hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-primary-border-strong"
    >
      <QrSvg link={link} label={`${name} 신청 링크 QR`} className={size.qrThumb} measure="qr" />
    </button>
  )
}

export function QrSheet({
  link,
  name,
  onSave,
  onClose,
}: {
  link: string
  name: string
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="포스터용 QR" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 p-6">
        <QrSvg link={link} label={`${name} 신청 링크 QR`} className={size.qrLarge} />
        <MainButton wide onClick={onSave}>
          <Download aria-hidden className="size-4" />
          QR 저장
        </MainButton>
      </div>
    </Sheet>
  )
}
