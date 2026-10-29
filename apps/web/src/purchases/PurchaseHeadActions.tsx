import { Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

// 머리글 오른쪽의 [내 구매 요청]·[+ 새 구매 요청](와이어프레임 PUR-00·EVT-FIN-01). 새 요청은 구매 요청 권한이 있을 때만이다.
export function PurchaseHeadActions({
  onMine,
  onCreate,
}: {
  onMine: () => void
  onCreate: (() => void) | null
}) {
  return (
    <>
      <Button touch variant="outline" onClick={onMine}>
        <User aria-hidden />내 구매 요청
      </Button>
      {onCreate && (
        <Button touch onClick={onCreate}>
          <Plus aria-hidden />새 구매 요청
        </Button>
      )}
    </>
  )
}
