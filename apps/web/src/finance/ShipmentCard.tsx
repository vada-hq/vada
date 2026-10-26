import {
  SHIPMENT_CARRIER_LABELS,
  SHIPMENT_TRACKING_PAGES,
  type PurchaseShipment,
  type ShipmentTrackingResponse,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { dayTimeLabel } from '@/lib/korean-date-text'

type Props = {
  shipment: PurchaseShipment
  itemNames: string[]
  tracking: ShipmentTrackingResponse | null
  loading: boolean
  busy: boolean
  onEdit: () => void
  onCancel: () => void
}

// 표시 전용 카드. 배송 상태를 받을 수 없어도 송장과 공개 조회 링크는 남긴다.
const statusLabel = (tracking: ShipmentTrackingResponse | null) =>
  tracking?.lastEvent ? (tracking.lastEvent.status.name ?? '배송 정보') : '조회 안 됨'

function Tracking({
  shipment,
  tracking,
  loading,
}: Pick<Props, 'shipment' | 'tracking' | 'loading'>) {
  const event = tracking?.lastEvent
  return (
    <>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600">
        <span>{loading ? '조회 중' : statusLabel(tracking)}</span>
        {event?.description && <span className="wrap-anywhere">{event.description}</span>}
        {event?.time && <time dateTime={event.time}>{dayTimeLabel(event.time)}</time>}
      </div>
      <a
        href={tracking?.trackingUrl ?? SHIPMENT_TRACKING_PAGES[shipment.carrierId]}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-xs text-blue-700 underline underline-offset-4"
      >
        택배사에서 보기
      </a>
    </>
  )
}

export function ShipmentCard({
  shipment,
  itemNames,
  tracking,
  loading,
  busy,
  onEdit,
  onCancel,
}: Props) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-sm border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <span>{SHIPMENT_CARRIER_LABELS[shipment.carrierId]}</span>
        <span className="wrap-anywhere tabular-nums">{shipment.trackingNumber}</span>
        {shipment.cancelledAt && <Badge>송장 취소됨</Badge>}
      </div>
      <p className="text-xs wrap-anywhere text-gray-600">{itemNames.join(' · ')}</p>
      {!shipment.cancelledAt && (
        <Tracking shipment={shipment} tracking={tracking} loading={loading} />
      )}
      {shipment.createdBy && (
        <span className="text-xs wrap-anywhere text-gray-500">등록: {shipment.createdBy.name}</span>
      )}
      {shipment.editable && !shipment.cancelledAt && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" busy={busy} onClick={onEdit}>
            고치기
          </Button>
          <Button variant="outline" size="sm" busy={busy} onClick={onCancel}>
            송장 취소
          </Button>
        </div>
      )}
    </li>
  )
}
