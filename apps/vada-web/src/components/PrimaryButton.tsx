import { ArrowRight } from 'lucide-react'

interface PrimaryButtonProps {
  label: string
  onClick: () => void
}

// Btn 7:77: py 7→8, px 14→16, gap 5.25→6, radius 3.5→4(rounded),
// bg #155DFC(blue-600), 텍스트 12.25→14(text-sm) medium, ArrowRight 14→16.
export function PrimaryButton({ label, onClick }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      {label}
      <ArrowRight className="size-4" />
    </button>
  )
}
