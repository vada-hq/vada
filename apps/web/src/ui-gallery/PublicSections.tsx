import type { MyRegistration, PublicRegistrationForm } from '@vada/contracts'
import QrCode from '@/components/QrCode'
import ApplyFields from '@/public/ApplyFields'
import FormSummary from '@/public/FormSummary'
import { MyRegistrationView } from '@/public/MyRegistrationPage'
import RegistrationUnavailable from '@/public/RegistrationUnavailable'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const QR_TEXT = 'VADA:0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'
const event = {
  name: '신입생 환영회',
  startsAt: '2026-10-24T14:00',
  endsAt: '2026-10-24T18:00',
  place: '대강당',
}
const form = {
  name: '환영회 참가 신청',
  opensAt: null,
  closesAt: '2026-10-23T18:00',
  notice: '문의는 오픈채팅으로 해 주세요.',
}

const publicForm = (extra: Partial<PublicRegistrationForm> = {}): PublicRegistrationForm => ({
  councilName: '소프트웨어학부 학생회',
  event,
  form,
  status: 'open',
  remaining: 12,
  payerFee: 5000,
  nonPayerFee: 10000,
  collectsStudentId: true,
  collectsPhone: false,
  purgeOn: '2027-10-24',
  questions: [],
  ...extra,
})

const mineOf = (extra: Partial<MyRegistration> = {}): MyRegistration => ({
  event: { name: event.name },
  form: { notice: form.notice },
  mine: { name: '김새내', studentId: '20260001', phone: null },
  answers: [],
  appliedFee: 5000,
  depositConfirmed: false,
  account: { bank: '국민은행', accountNumber: '123-456-789012', holder: '소프트웨어학부 학생회' },
  qrText: QR_TEXT,
  attended: false,
  cancellable: true,
  ...extra,
})

// 실제 공개 화면과 같은 max-w-md 틀로 1280px·390px에서 비교한다.
export function PublicSection() {
  const completed = [
    mineOf(),
    mineOf({ depositConfirmed: true }),
    mineOf({ appliedFee: 0, account: null, attended: true, cancellable: false }),
    mineOf({ event: { name: unbroken }, mine: { name: longName, studentId: null, phone: null } }),
  ]
  return (
    <Section title="참가 신청 화면">
      <div className="flex w-full max-w-md flex-col gap-4">
        <FormSummary data={publicForm()} />
      </div>
      {(['before_open', 'full', 'paused', 'closed'] as const).map(status => (
        <div key={status} className="w-full max-w-md">
          <RegistrationUnavailable
            data={publicForm({
              status,
              remaining: status === 'full' ? 0 : null,
              form: { ...form, opensAt: '2026-10-22T09:00' },
            })}
          />
        </div>
      ))}
      {completed.map((mine, index) => (
        <div key={index} className="w-full max-w-md">
          <MyRegistrationView
            mine={mine}
            cancel={{ busy: false, problem: '', run: async () => {} }}
          />
        </div>
      ))}
      <QrCode text={QR_TEXT} label="QR 예시" />
    </Section>
  )
}

const emptyValues = { name: '', studentId: '', phone: '' }

// 신청 칸과 버튼 아래 고지. 참가비가 있으면 목적에 입금 확인이 붙고, 무료 양식에는 없다(DEC-93). 공개 화면과 같은 폭(max-w-md)이다.
export function ApplyNoticeSection() {
  const cases = [
    publicForm(),
    publicForm({
      payerFee: null,
      nonPayerFee: null,
      collectsStudentId: false,
      collectsPhone: true,
    }),
  ]
  return (
    <Section title="참가 신청 칸·고지(참가비 있음·없음)">
      {cases.map(data => (
        <div key={String(data.payerFee)} className="w-full max-w-md">
          <ApplyFields
            data={data}
            values={emptyValues}
            busy={false}
            problem=""
            onValues={() => {}}
            onSubmit={() => {}}
          />
        </div>
      ))}
    </Section>
  )
}
