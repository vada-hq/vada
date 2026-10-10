import { qrMatrix } from '@/lib/qr-code'
import { cn } from '@/lib/utils'

type Props = { value: string; label: string; className?: string }

// 글자를 QR(SVG)로 그린다. 판독이 잘 되게 검정·흰색으로 고정한다. 표시만 하고 API를 부르지 않는다.
export function QrCode({ value, label, className }: Props) {
  const matrix = qrMatrix(value)
  const path = matrix.flatMap((row, y) => row.map((dark, x) => dark ? `M${x} ${y}h1v1h-1z` : '')).join('')
  return <svg role="img" aria-label={label} viewBox={`0 0 ${matrix.length} ${matrix.length}`} shapeRendering="crispEdges"
    className={cn('bg-white', className)}><path d={path} className="fill-black" /></svg>
}
