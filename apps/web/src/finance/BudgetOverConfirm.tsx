import { ConfirmDialog } from '@/components/ConfirmDialog'
import { signedWon } from './closing-view'

// 이번 동작 뒤 사용 가능이 음수가 되는 항목 하나. available은 동작 뒤의 사용 가능(음수)이다.
type OverLine = { id: string; purpose: string; available: number }

type Props = {
  open?: boolean
  // 넘는 항목. 예산 줄이기는 하나, 결재는 같은 요청의 품목이 여러 항목을 넘을 수 있어 여럿이다.
  lines: readonly OverLine[]
  // 그 값이 언제의 것인지: '저장하면'(예산 줄이기), '승인하면'(결재 초과)
  when: string
  // '그래도 저장'(예산 줄이기), '그래도 승인'(결재 초과)처럼 동작을 붙인다.
  confirmLabel: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

// 사용 가능이 음수가 되는 동작 앞의 확인 한 번(DEC-92, 024 정한 것 10). 막지 않고 알린 뒤 넘긴다(Procurify "approve it anyway?").
// 예산 항목 줄이기와 결재의 예산 초과가 이 창 하나를 쓴다. 문구 차이(when, confirmLabel)는 쓰는 쪽이 준다.
// 항목 이름(굵게)과 '저장하면 사용 가능 -50,000원'을 두 줄로 나눠, 이름과 숫자가 한 덩어리로 읽히지 않게 한다.
export function BudgetOverConfirm({ lines, when, ...rest }: Props) {
  return (
    <ConfirmDialog title="사용 가능 금액 초과" {...rest}>
      <ul className="flex flex-col gap-3 text-sm text-fg-secondary">
        {lines.map(line => (
          <li key={line.id} className="flex flex-col gap-1">
            <p className="font-semibold wrap-anywhere text-fg">{line.purpose}</p>
            <p>
              {when} 사용 가능{' '}
              <span className="font-semibold text-danger-emphasis tabular-nums">
                {signedWon(line.available)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}
