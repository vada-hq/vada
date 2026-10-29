import { useState } from 'react'
import {
  CancelShipmentSchema,
  type PurchaseRequestDetail,
  type PurchaseShipment,
} from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { purchaseShipmentPath } from './finance-api'
import type { PurchaseDialogHandlers } from './purchase-requests'
import { ShipmentCard } from './ShipmentCard'
import { ShipmentFormDialog } from './ShipmentFormDialog'
import type { ShipmentActions } from './useShipmentActions'
import { useShipmentTracking } from './useShipmentTracking'

type Props = {
  councilId: string
  request: PurchaseRequestDetail
  actions: ShipmentActions
  busy: boolean
  onLost: PurchaseDialogHandlers['onLost']
  onForbidden: PurchaseDialogHandlers['onForbidden']
}
type Mode = { kind: 'new' } | { kind: 'edit' | 'cancel'; shipment: PurchaseShipment }

function LiveShipment({
  shipment,
  request,
  ...props
}: Omit<Props, 'actions'> & {
  shipment: PurchaseShipment
  onEdit: () => void
  onCancel: () => void
}) {
  const path = shipment.cancelledAt
    ? null
    : `${purchaseShipmentPath(props.councilId, request.id, shipment.id)}/tracking`
  const read = useShipmentTracking(path, props)
  return (
    <ShipmentCard
      shipment={shipment}
      itemNames={request.items
        .filter(item => shipment.lineItemIds.includes(item.id))
        .map(item => item.name)}
      {...read}
      busy={props.busy}
      onEdit={props.onEdit}
      onCancel={props.onCancel}
    />
  )
}

function ShipmentDialogs({
  mode,
  request,
  actions,
  busy,
  onClose,
  onFinish,
}: Pick<Props, 'request' | 'actions' | 'busy'> & {
  mode: Mode
  onClose: () => void
  onFinish: (result: 'done' | 'closed' | 'failed') => void
}) {
  if (mode.kind === 'cancel')
    return (
      <CancelReasonDialog
        destructive
        title="이 송장을 취소할까요?"
        reasonLabel="취소 사유"
        confirmLabel="송장 취소"
        busy={busy}
        error={actions.problem}
        parse={reason => CancelShipmentSchema.safeParse({ reason })}
        onClose={onClose}
        onConfirm={reason => void actions.cancel(mode.shipment.id, reason).then(onFinish)}
      />
    )
  const shipmentId = mode.kind === 'edit' ? mode.shipment.id : undefined
  return (
    <ShipmentFormDialog
      request={request}
      shipment={mode.kind === 'edit' ? mode.shipment : undefined}
      busy={busy}
      problem={actions.problem}
      onClose={onClose}
      onSave={values => void actions.save(values, shipmentId).then(onFinish)}
    />
  )
}

export function RequestShipments({ request, actions, ...props }: Props) {
  const [mode, setMode] = useState<Mode | null>(null)
  const open = (next: Mode) => {
    actions.clearProblem()
    setMode(next)
  }
  const finish = (result: 'done' | 'closed' | 'failed') => {
    if (result !== 'failed') setMode(null)
  }
  if (!request.canAddShipment && request.shipments.length === 0 && !actions.problem) return null
  return (
    <section aria-label="배송" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-fg-secondary">배송</h3>
      {request.shipments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {request.shipments.map(shipment => (
            <LiveShipment
              key={`${shipment.id}:${shipment.carrierId}:${shipment.trackingNumber}:${shipment.cancelledAt ?? ''}`}
              shipment={shipment}
              request={request}
              {...props}
              onEdit={() => open({ kind: 'edit', shipment })}
              onCancel={() => open({ kind: 'cancel', shipment })}
            />
          ))}
        </ul>
      )}
      {request.canAddShipment && (
        <Button
          variant="outline"
          className="self-start"
          busy={props.busy}
          onClick={() => open({ kind: 'new' })}
        >
          송장 넣기
        </Button>
      )}
      {!mode && actions.problem && <StateMessage kind="error">{actions.problem}</StateMessage>}
      {mode && (
        <ShipmentDialogs
          mode={mode}
          request={request}
          actions={actions}
          busy={props.busy}
          onClose={() => setMode(null)}
          onFinish={finish}
        />
      )}
    </section>
  )
}
