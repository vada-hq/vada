import type { ApplicantChange } from '@vada/contracts'
import type { ScanOutcome } from '@/registrations/check-in'
import { ScanActions } from '@/registrations/ScanActions'
import { ScanResultCard } from '@/registrations/ScanResultCard'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}
type Checked = Extract<ScanOutcome, { kind: 'checked' }>
const unpaid: ApplicantChange = {
  id: '00000000-0000-4000-8000-0000000000a1',
  attended: true,
  absent: false,
  cancelled: false,
  deposit: { status: 'none', amount: null },
  listed: true,
  actions: ['registration.cancel_check_in', 'deposit.confirm'],
}
const paid: ApplicantChange = {
  ...unpaid,
  deposit: { status: 'confirmed', amount: 5000 },
  actions: ['registration.cancel_check_in', 'deposit.cancel'],
}
const person = (extra: Partial<Checked> = {}): Checked => ({
  kind: 'checked',
  attendanceId: '00000000-0000-4000-8000-0000000000b1',
  name: '김새내',
  studentId: '20260001',
  appliedFee: 5000,
  applicant: unpaid,
  ...extra,
})
type Example = { outcome: ScanOutcome; paid?: boolean }
const examples: Example[] = [
  { outcome: person({ name: longName }) },
  { outcome: person({ applicant: paid }), paid: true },
  { outcome: person({ appliedFee: 0, applicant: { ...unpaid, actions: [] } }) },
  { outcome: person({ applicant: { ...paid, deposit: { status: 'confirmed', amount: 4000 } } }) },
  { outcome: person({ applicant: { ...unpaid, actions: ['registration.cancel_check_in'] } }) },
  // 이전 서버 응답(적용 참가비 없음)은 무료로 추정하지 않는다.
  {
    outcome: {
      kind: 'checked',
      attendanceId: '00000000-0000-4000-8000-0000000000b1',
      name: '김새내',
      studentId: null,
      applicant: unpaid,
    },
  },
  {
    outcome: {
      ...person({ applicant: paid }),
      kind: 'already',
      checkedInAt: '2026-10-27T05:03:00.000Z',
    },
  },
  // 이미 출석했지만 참가비를 받지 못한 사람: 입장 불가는 그대로 두고 받기만 더한다(권한이 없으면 한 줄).
  { outcome: { ...person(), kind: 'already', checkedInAt: '2026-10-27T05:03:00.000Z' } },
  {
    outcome: {
      ...person({ applicant: { ...unpaid, actions: ['registration.cancel_check_in'] } }),
      kind: 'already',
      checkedInAt: '2026-10-27T05:03:00.000Z',
    },
  },
  { outcome: { kind: 'missing' } },
  { outcome: { kind: 'failed', message: '잠시 뒤 다시 시도해 주세요.' } },
  { outcome: person({ applicant: { ...unpaid, attended: false, actions: [] } }) },
]

// QR 출석 판정 카드: 판정(입장 가능/참가비 받기/입장 불가)이 먼저이고 판정마다 주 버튼은 하나다.
// 스캐너 창 안 폭(390px 휴대폰에서 약 310px)과 여백을 흉내 낸 틀에 담는다. 기록 금액이 참가비보다 작아도 완납으로 부르지 않는다.
export function ScanVerdictSection() {
  return (
    <Section title="QR 출석 판정 카드">
      {examples.map(({ outcome, paid: justPaid }, index) => (
        <div key={index} className="w-96 max-w-full rounded-lg border bg-white p-6 shadow-sm">
          <ScanResultCard outcome={outcome}>
            <ScanActions
              outcome={outcome}
              councilId="c1"
              busy={false}
              paid={justPaid === true}
              onNext={noop}
              onChange={noop}
              onGone={noop}
              onSaving={noop}
              onForbidden={noop}
              onLost={noop}
            />
          </ScanResultCard>
        </div>
      ))}
    </Section>
  )
}
