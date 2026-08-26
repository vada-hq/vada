import { ArrowRight } from 'lucide-react'

interface PrimaryButtonProps {
  label: string
  /** design 대조가 이 버튼을 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  onClick: () => void
  // ONB-01(7:77)은 카드 폭 전체, ORG-01(14:233)은 내용 폭이다.
  fullWidth?: boolean
  /** 디자인에 화살표가 없는 주 버튼도 있다(FIN-PROC-01 30:1761). */
  trailingArrow?: boolean
  /** 같은 주 행동이라도 표 다음 단계 버튼은 글을 한 단계 더 강조한다. */
  strong?: boolean
  /** 내용 폭 버튼 중 FIN-PROC-01처럼 좌우·상하 여백이 더 큰 형태. */
  roomy?: boolean
  disabled?: boolean
}

// Btn 7:77: py 7→8, px 14→16, gap 5.25→6, radius 3.5→4(rounded),
// bg #155DFC(blue-600), 텍스트 12.25→14(text-sm) medium, ArrowRight 14→16.
export function PrimaryButton({
  label,
  nodeId,
  onClick,
  fullWidth = true,
  trailingArrow = true,
  strong = false,
  roomy = false,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      data-node-id={nodeId}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 bg-blue-600 text-sm text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        roomy ? 'rounded-md px-6 py-2.5' : 'rounded px-4 py-2'
      } ${
        strong ? 'font-bold' : 'font-medium'
      } ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {label}
      {trailingArrow && <ArrowRight className="size-4" />}
    </button>
  )
}
