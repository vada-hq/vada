import type { AccountItem } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ACCOUNT_TYPE_LABEL } from './account-form'

type Props = {
  account: AccountItem
  onEdit: () => void
  onClose: () => void
}

// 계좌 카드: 이름과 종류·닫힘 칩, 은행, 계좌번호, 예금주. 고치기·닫기는 서버가 준 동작(finance.manage)이 있을 때만 보인다(닫은 계좌는 없다).
// 계좌번호와 예금주는 화면에만 보이고 로그나 오류 보고에 넣지 않는다.
export function AccountCard({ account, onEdit, onClose }: Props) {
  const manage = account.actions.includes('finance.manage')
  return (
    <Card className="flex flex-col gap-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 font-medium wrap-anywhere text-gray-900">{account.name}</span>
        <Badge tone={account.type === 'main' ? 'info' : 'neutral'}>
          {ACCOUNT_TYPE_LABEL[account.type]}
        </Badge>
        {account.closedOn && <Badge tone="danger">닫힘 {account.closedOn}</Badge>}
      </div>
      <div className="flex flex-col gap-1 text-xs text-gray-500">
        <span className="wrap-anywhere">{account.bank}</span>
        <span className="wrap-anywhere text-gray-800">{account.accountNumber}</span>
        <span className="wrap-anywhere">예금주 {account.holder}</span>
      </div>
      {manage && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            고치기
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      )}
    </Card>
  )
}
