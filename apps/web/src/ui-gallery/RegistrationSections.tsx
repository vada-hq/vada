import { REGISTRATION_STATUSES, type Applicant, type RegistrationForm } from '@vada/contracts'
import { ApplicantRow } from '@/registrations/ApplicantRow'
import { FormCard } from '@/registrations/FormCard'
import { ScanResultCard } from '@/registrations/ScanResultCard'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const form = (id: string, extra: Partial<RegistrationForm>): RegistrationForm => ({
  id,
  eventId: 'e1',
  name: '환영회 참가 신청',
  opensAt: null,
  closesAt: '2026-10-23T18:00',
  capacity: 50,
  notice: null,
  collectsPhone: false,
  paused: false,
  publicCode: 'ABCD2345',
  payerFee: 5000,
  nonPayerFee: 10000,
  feeAccount: null,
  status: 'open',
  applicantCount: 12,
  attendedCount: 0,
  remaining: 38,
  purgeOn: '2027-10-24',
  actions: ['registration.manage', 'registration.view_applicants'],
  ...extra,
})

const noop = () => {}
const handlers = { onForbidden: noop, onLost: noop }
const attendance = new Map<string, boolean>()

function Card({ data }: { data: RegistrationForm }) {
  return (
    <FormCard
      councilId="c1"
      form={data}
      canRefund
      attendance={attendance}
      onAttendance={noop}
      onLoaded={noop}
      onEdit={noop}
      onChanged={noop}
      {...handlers}
    />
  )
}

const applicant = (id: string, extra: Partial<Applicant>): Applicant => ({
  id,
  name: '김새내',
  studentId: '20260001',
  phone: null,
  appliedFee: 5000,
  payer: true,
  duplicateStudentId: false,
  attended: false,
  appliedAt: '2026-10-20T05:00:00.000Z',
  cancelled: false,
  deposit: { status: 'none', amount: null },
  ...extra,
})

const can = { manage: true, deposit: true, refund: true }

// 신청자 줄: 입금 안 함, 입금 확인, 환불 대기(취소함), 참가비 없음, 긴 이름. 390px 폭에서 본다.
export function ApplicantRowSection() {
  const rows = [
    applicant('none', {}),
    applicant('paid', { deposit: { status: 'confirmed', amount: 5000 } }),
    applicant('refund', { cancelled: true, deposit: { status: 'refund_pending', amount: 5000 } }),
    applicant('free', { appliedFee: 0, payer: null }),
    applicant('long', { name: `${unbroken} ${longName}` }),
  ]
  return (
    <Section title="신청자 줄·입금 칩·환불 대기">
      <ul className="flex w-96 max-w-full flex-col gap-2">
        {rows.map(row => (
          <ApplicantRow
            key={row.id}
            councilId="c1"
            applicant={row}
            attended={false}
            can={can}
            onAttendance={noop}
            onCancelled={noop}
            onDeposit={noop}
            {...handlers}
          />
        ))}
      </ul>
    </Section>
  )
}

// 신청 양식 카드(상태 배지 다섯, 권한 없음, 긴 이름)와 QR 스캐너의 결과 카드. 390px 폭에서 본다.
export function RegistrationSection() {
  return (
    <Section title="신청 양식 카드·상태 배지·스캔 결과">
      <div className="flex w-96 max-w-full flex-col gap-2">
        {REGISTRATION_STATUSES.map(status => (
          <Card key={status} data={form(status, { status, paused: status === 'paused' })} />
        ))}
        <Card data={form('view', { actions: [], capacity: null, opensAt: '2026-10-22T09:00' })} />
        <Card data={form('long', { name: `${unbroken} ${longName}` })} />
        <ScanResultCard
          outcome={{ kind: 'checked', registrationId: 'r1', name: '김새내', studentId: '20260001' }}
          onNext={noop}
        />
        <ScanResultCard outcome={{ kind: 'missing' }} onNext={noop} />
      </div>
    </Section>
  )
}
