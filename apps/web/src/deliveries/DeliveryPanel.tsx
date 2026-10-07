import { useState } from 'react'
import type { PurchaseDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import ShipmentForm from './ShipmentForm'
import { carrierName, deliveryStatusLabels, deliveryStatusTones } from './delivery-status'
import { useDeliveries } from './useDeliveries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = { request: PurchaseDetail; finance: boolean }

// 승인된 요청서의 품목별 배송 상태. 배송 수량 배분이 없으므로 요청서 전체 완료 여부는 판정하지 않는다.
export default function DeliveryPanel({ request, finance }: Props) {
  const data = useDeliveries(request.organizationId, request.eventId, request.id, finance)
  // 등록에 성공하면 입력 폼을 새로 만들어 기본 선택(송장 없는 품목)을 다시 계산한다.
  const [formRevision, setFormRevision] = useState(0)
  if (!data.available || data.items === null) return null
  const shipmentsOf = (id: string) => data.items?.find(item => item.id === id)?.shipments ?? []
  const rows = [...request.items].sort((a, b) => a.position - b.position)
  const time = (value: string) => new Date(value).toLocaleString('ko-KR')
  return <section className={cn(cardClass, 'flex flex-col gap-3 p-4')} aria-label="구매·발주 처리">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">구매·발주 처리</h3>
      <Button variant="ghost" size="sm" disabled={data.busy} onClick={data.refresh}>배송 상태 새로고침</Button>
    </div>
    {data.error && <StateMessage kind="error">{data.error}</StateMessage>}
    {data.notice && <StateMessage kind="notice">{data.notice}</StateMessage>}
    <table className="w-full border-collapse text-sm wrap-anywhere">
      <thead><tr className="border-b text-left text-xs text-gray-500">
        <th scope="col" className="px-3 py-2 font-normal">품목</th><th scope="col" className="px-3 py-2 font-normal">수량</th><th scope="col" className="px-3 py-2 font-normal">배송 상태</th>
      </tr></thead>
      <tbody>{rows.map(item => {
        const shipments = shipmentsOf(item.id)
        return <tr key={item.id} className="border-b border-gray-100 align-top">
          <th scope="row" className="px-3 py-2 text-left font-medium">{item.productName || '상품명 확인 필요'}</th>
          <td className="px-3 py-2">{item.quantity ?? '—'}</td>
          <td className="px-3 py-2">{shipments.length === 0 ? '—' : <ul className="flex flex-col gap-2">{shipments.map(shipment => <li key={shipment.linkId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={deliveryStatusTones[shipment.status] ?? 'neutral'}>{deliveryStatusLabels[shipment.status] ?? deliveryStatusLabels.unknown}</Badge>
            <span>{carrierName(shipment.carrierId, data.carriers)} · {shipment.trackingNumber}</span>
            {shipment.lastCheckedAt && <span className="text-xs text-gray-500">확인 {time(shipment.lastCheckedAt)}</span>}
            {shipment.refreshFailed && <span className="text-xs text-destructive">최근 확인 실패</span>}
            {finance && <Button variant="ghost" size="sm" disabled={data.busy} onClick={() => {
              if (window.confirm('이 송장 연결을 해제할까요? 해제한 뒤 올바른 송장을 다시 등록할 수 있어요.')) data.unlink(shipment.id, shipment.linkId)
            }}>연결 해제</Button>}
          </li>)}</ul>}</td>
        </tr>
      })}</tbody>
    </table>
    <p className="text-xs text-gray-500">배송 상태는 택배사 기록을 기준으로 자동 갱신돼요. 품목 수량이 모두 도착했는지는 직접 확인해 주세요.</p>
    {finance && <ShipmentForm key={formRevision} busy={data.busy} carriers={data.carriers} onSearchCarriers={data.searchCarriers}
      items={rows.map(item => ({ id: item.id, name: item.productName || '상품명 확인 필요', shipped: shipmentsOf(item.id).length > 0 }))}
      onLookup={data.lookup} onRegister={async (input, itemIds) => {
        const done = await data.register(input, itemIds)
        if (done) setFormRevision(value => value + 1)
        return done
      }} />}
  </section>
}
