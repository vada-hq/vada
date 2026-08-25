import { CAUTION_BUTTON } from '../design/tones'

interface CautionButtonProps {
  label: string
  nodeId?: string
  onClick: () => void
  disabled?: boolean
}

// 주의를 요구하지만 삭제처럼 위험한 동작은 아닌 작은 보조 행동.
export function CautionButton({ label, nodeId, onClick, disabled = false }: CautionButtonProps) {
  return (
    <button
      type="button"
      data-node-id={nodeId}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-yellow-500/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${CAUTION_BUTTON}`}
    >
      {label}
    </button>
  )
}
