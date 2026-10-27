import type { MadeRecord } from '@vada/contracts'
import { Receipt, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'

// 만든 기록은 만들 권한과 별개다. 서버가 상세 읽기와 같은 권한으로 준 기록만 연다(DEC-90).
export default function MessageMade({
  councilId,
  records,
}: {
  councilId: string
  records: MadeRecord[]
}) {
  return records.map(record => (
    <Button
      key={record.id}
      variant="link"
      size="sm"
      touch
      className="h-auto max-w-full justify-start px-0 text-left whitespace-normal"
      onClick={() =>
        openRecord(
          record.kind === 'purchase_request' ? 'purchases' : 'expenses',
          councilId,
          record.id,
        )
      }
    >
      {record.kind === 'purchase_request' ? <ShoppingCart /> : <Receipt />}
      <span className="min-w-0 wrap-anywhere">
        {record.kind === 'purchase_request' ? '구매 요청' : '지출'} · {record.title}
      </span>
    </Button>
  ))
}
