import { useState } from 'react'
import { AddFeePaymentsSchema, type FiscalPeriodSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { FeePaymentReplaceConfirm } from '@/finance/FeePaymentReplaceConfirm'
import { FeePaymentUploadFields } from '@/finance/FeePaymentUploadFields'
import { Section } from './GallerySection'

const period: FiscalPeriodSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '2026년 2학기',
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
  current: true,
  previousPeriodId: null,
  status: 'draft',
  publishedAt: null,
}

function UploadSample({ width, manual }: { width: string; manual: boolean }) {
  const [selected, setSelected] = useState(manual ? 'manual' : period.id)
  const [values, setValues] = useState({
    paidFrom: '2026-07-01',
    paidUntil: '2026-12-31',
    students: '20260001\n20260002',
  })
  const [reading, setReading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={`flex max-w-full flex-col gap-4 rounded-lg border bg-white p-6 ${width}`}>
      <h3 className="text-base font-semibold break-keep">납부자 명단 올리기</h3>
      <FeePaymentUploadFields
        values={values}
        periods={[period]}
        selected={selected}
        saving={reading}
        errors={{}}
        onSelect={id => {
          setSelected(id)
          if (id !== 'manual')
            setValues({ ...values, paidFrom: period.startsOn, paidUntil: period.endsOn })
        }}
        onChange={setValues}
        onReading={setReading}
      />
      <Button
        touch
        busy={reading}
        className="self-end"
        onClick={() => {
          if (AddFeePaymentsSchema.safeParse(values).success) setConfirming(true)
        }}
      >
        올리기
      </Button>
      {confirming && (
        <FeePaymentReplaceConfirm
          busy={false}
          error={null}
          onConfirm={() => setConfirming(false)}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

export function FeePaymentUploadSection() {
  return (
    <Section title="납부자 명단: 학기·파일·바꾸기">
      <div className="flex max-w-full flex-col gap-2">
        <p className="text-xs text-muted-foreground">1280px 창</p>
        <UploadSample width="w-128" manual={false} />
      </div>
      <div className="flex max-w-full flex-col gap-2">
        <p className="text-xs text-muted-foreground">390px 창</p>
        <UploadSample width="w-89.5" manual />
      </div>
    </Section>
  )
}
