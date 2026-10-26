import { ConfirmDialog } from '@/components/ConfirmDialog'
import { signedWon } from './closing-view'
import type { Overage } from './decision-budget'

type Props = {
  open: boolean
  overages: readonly Overage[]
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}

// 승인하면 사용 가능이 음수가 되는 항목이 있을 때 보내기 전 한 번 묻는다(DEC-92, 024 정한 것 10). 막지 않고 알린 뒤 넘긴다
// (Procurify "approve it anyway?"). 예산 줄이기(조각 6)의 확인 창과 제목·줄 모양이 같다. 항목이 여럿일 수 있어 줄마다 그린다.
export function DecisionOverConfirm({ overages, ...rest }: Props) {
  return (
    <ConfirmDialog title="사용 가능 금액 초과" confirmLabel="그래도 승인" {...rest}>
      <ul className="flex flex-col gap-3 text-sm text-gray-700">
        {overages.map(overage => (
          <li key={overage.id} className="flex flex-col gap-1">
            <p className="font-semibold wrap-anywhere text-gray-900">{overage.purpose}</p>
            <p>
              승인하면 사용 가능{' '}
              <span className="font-semibold text-red-600 tabular-nums">
                {signedWon(overage.after)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}
