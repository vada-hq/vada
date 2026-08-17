import { ArrowRight } from 'lucide-react'

interface PrimaryButtonProps {
  label: string
  onClick: () => void
  // ONB-01(7:77)은 카드 폭 전체, ORG-01(14:233)은 내용 폭이다.
  fullWidth?: boolean
}

// Btn 7:77: py 7→8, px 14→16, gap 5.25→6, radius 3.5→4(rounded),
// bg #155DFC(blue-600), 텍스트 12.25→14(text-sm) medium, ArrowRight 14→16.
export function PrimaryButton({ label, onClick, fullWidth = true }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {label}
      <ArrowRight className="size-4" />
    </button>
  )
}
