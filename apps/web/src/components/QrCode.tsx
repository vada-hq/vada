import { qrMatrix, qrPath } from '@/lib/qr-code'

// 흰 바탕의 QR. 어두운 화면 설정이어도 스캐너가 읽도록 바탕은 항상 흰색이고 여백(2칸)이 matrix에 들어 있다.
export default function QrCode({ text, label }: { text: string; label: string }) {
  const matrix = qrMatrix(text)
  const size = matrix.length
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-56 max-w-full rounded-sm bg-white"
    >
      <path d={qrPath(matrix)} fill="#000" />
    </svg>
  )
}
