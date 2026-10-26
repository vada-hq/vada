import {
  ShipmentSchema,
  type PurchaseRequestDetail,
  type PurchaseShipment,
  type ShipmentInput,
} from '@vada/contracts'
import { requiredText, withContract } from '@/lib/use-form-check'

export const approvedItems = (request: PurchaseRequestDetail) =>
  request.items.filter(item => item.status === 'approved')
export function initialShipment(
  request: PurchaseRequestDetail,
  shipment?: PurchaseShipment,
): ShipmentInput {
  if (shipment)
    return {
      carrierId: shipment.carrierId,
      trackingNumber: shipment.trackingNumber,
      lineItemIds: [...shipment.lineItemIds],
    }
  const covered = new Set(
    request.shipments.filter(row => !row.cancelledAt).flatMap(row => row.lineItemIds),
  )
  return {
    carrierId: 'kr.coupangls',
    trackingNumber: '',
    lineItemIds: approvedItems(request)
      .filter(item => !covered.has(item.id))
      .map(item => item.id),
  }
}
export const shipmentErrors = (values: ShipmentInput) =>
  withContract(
    {
      trackingNumber: requiredText(values.trackingNumber, '송장 번호를'),
      lineItemIds: values.lineItemIds.length === 0 ? '품목을 하나 이상 선택해 주세요' : undefined,
    },
    ShipmentSchema.safeParse(values),
    { trackingNumber: '숫자와 하이픈으로 송장 번호를 입력해 주세요' },
  )
