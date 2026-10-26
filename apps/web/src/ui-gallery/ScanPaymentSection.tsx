import type { ApplicantChange } from '@vada/contracts'
import type { ScanOutcome } from '@/registrations/check-in'
import { ScanPayment } from '@/registrations/ScanPayment'
import { ScanResultCard } from '@/registrations/ScanResultCard'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}
type Checked = Extract<ScanOutcome, { applicant: ApplicantChange }>
const unpaid: ApplicantChange = {
  id: '00000000-0000-4000-8000-0000000000a1',
  attended: true,
  cancelled: false,
  deposit: { status: 'none', amount: null },
  listed: true,
  actions: ['registration.cancel_check_in', 'deposit.confirm'],
}
const sample = (extra: Partial<Checked> = {}): Checked => ({
  kind: 'checked',
  name: longName,
  studentId: '20260001',
  appliedFee: 5000,
  applicant: unpaid,
  ...extra,
})
const examples: ScanOutcome[] = [
  sample(),
  sample({ kind: 'already' }),
  sample({ applicant: { ...unpaid, actions: ['registration.cancel_check_in'] } }),
  sample({
    applicant: {
      ...unpaid,
      deposit: { status: 'confirmed', amount: 4000 },
      actions: ['registration.cancel_check_in', 'deposit.cancel'],
    },
  }),
  sample({ appliedFee: 0, applicant: { ...unpaid, actions: ['registration.cancel_check_in'] } }),
  { kind: 'checked', name: '참가비 미확인', studentId: null, applicant: unpaid },
  { kind: 'failed', message: '잠시 뒤 다시 시도해 주세요.' },
]

// 출석과 입금을 구분하며, 기록 금액이 참가비보다 작아도 완납으로 부르지 않는다.
export function ScanPaymentSection() {
  return (
    <Section title="QR 출석 결과·현장 입금 확인">
      <div className="flex w-96 max-w-full flex-col gap-4">
        {examples.map((outcome, index) => (
          <ScanResultCard key={index} outcome={outcome} onNext={noop}>
            {'applicant' in outcome && (
              <ScanPayment
                outcome={outcome}
                councilId="c1"
                onChange={noop}
                onGone={noop}
                onSaving={noop}
                onForbidden={noop}
                onLost={noop}
              />
            )}
          </ScanResultCard>
        ))}
      </div>
    </Section>
  )
}
