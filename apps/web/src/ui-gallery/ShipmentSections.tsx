import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShipmentCard } from '@/finance/ShipmentCard'
import { ShipmentFormDialog } from '@/finance/ShipmentFormDialog'
import { Section } from './GallerySection'
import { shipmentRequestSample, shipmentSample, trackingSample } from './shipment-samples'

const noop = () => {}

export function ShipmentSection() {
  const [open, setOpen] = useState(false)
  const names = shipmentRequestSample.items.map(item => item.name)
  return (
    <Section title="배송 · 송장 등록과 조회">
      <div className="flex w-full max-w-148 flex-col gap-3">
        <ul className="grid gap-3 sm:grid-cols-2">
          <ShipmentCard
            shipment={shipmentSample}
            itemNames={names}
            tracking={trackingSample}
            loading={false}
            busy={false}
            onEdit={() => setOpen(true)}
            onCancel={noop}
          />
          <ShipmentCard
            shipment={{ ...shipmentSample, editable: false }}
            itemNames={names}
            tracking={{
              lastEvent: null,
              reason: 'not_configured',
              trackingUrl: trackingSample.trackingUrl,
            }}
            loading={false}
            busy={false}
            onEdit={noop}
            onCancel={noop}
          />
          <ShipmentCard
            shipment={{ ...shipmentSample, cancelledAt: '2026-10-26T06:00:00Z', editable: false }}
            itemNames={names}
            tracking={null}
            loading={false}
            busy={false}
            onEdit={noop}
            onCancel={noop}
          />
        </ul>
        <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
          송장 넣기
        </Button>
      </div>
      {open && (
        <ShipmentFormDialog
          request={shipmentRequestSample}
          busy={false}
          problem={null}
          onClose={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      )}
    </Section>
  )
}
