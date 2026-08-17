import { ArrowLeft } from 'lucide-react'

interface SecondaryButtonProps {
  label: string
  onClick: () => void
}

// Btn 14:226: py 7→8, px 14→16, gap 5.25→6, radius 3.5→4,
// bg white, border #D1D5DC(gray-300), 텍스트 12.25→14(text-sm) medium #364153(gray-700).
// ArrowLeft 14→16 — 아이콘은 스펙에 없어 figma.design.json(14:227)에서 식별했다.
export function SecondaryButton({ label, onClick }: SecondaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  )
}
