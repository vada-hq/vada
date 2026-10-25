import { ConfirmDialog } from '@/components/ConfirmDialog'
import { signedWon } from './closing-view'

type Props = {
  open?: boolean
  purpose: string
  // 이번 동작 뒤의 사용 가능(음수)
  available: number
  // '그래도 저장'(예산 줄이기), '그래도 승인'(결재 초과)처럼 동작을 붙인다.
  confirmLabel: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

// 사용 가능이 음수가 되는 동작 앞의 확인 한 번(DEC-92, 024 정한 것 10). 막지 않고 알린 뒤 넘긴다(Procurify "approve it anyway?").
// 예산 항목 줄이기와 결재의 예산 초과가 이 창 하나를 쓴다.
export function BudgetOverConfirm({ purpose, available, ...rest }: Props) {
  return (
    <ConfirmDialog title="사용 가능 금액 초과" {...rest}>
      <p className="text-sm wrap-anywhere text-gray-700">
        {purpose} 사용 가능{' '}
        <span className="font-semibold text-red-600 tabular-nums">{signedWon(available)}</span>
      </p>
    </ConfirmDialog>
  )
}
