import type { MyRegistration, PublicRegistrationForm } from '@vada/contracts'
import QrCode from '@/components/QrCode'
import FormSummary from '@/public/FormSummary'
import { AttendanceBlock, FeeBlock, MineFacts } from '@/public/MineDetails'
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
  ...extra,
})

const mineOf = (extra: Partial<MyRegistration> = {}): MyRegistration => ({
  councilName: '소프트웨어학부 학생회',
  event,
  form,
  mine: { name: '김새내', studentId: '20260001', phone: null },
  appliedFee: 5000,
  account: { bank: '국민은행', accountNumber: '123-456-789012', holder: '소프트웨어학부 학생회' },
  qrText: QR_TEXT,
  attended: false,
  cancellable: true,
  purgeOn: '2027-10-24',
  ...extra,
})

// 로그인 없이 쓰는 참가 신청 화면의 부품. 390px 폭에서 본다.
export function PublicSection() {
  return (
    <Section title="참가 신청 화면">
      <div className="flex w-96 max-w-full flex-col gap-4">
        <FormSummary data={publicForm()} />
        <FormSummary
          data={publicForm({
            status: 'full',
            remaining: 0,
            event: {
              name: `${unbroken} ${longName}`,
              startsAt: null,
              endsAt: null,
              place: longName,
            },
          })}
        />
      </div>
      <div className="flex w-96 max-w-full flex-col gap-4">
        <AttendanceBlock mine={mineOf()} />
        <AttendanceBlock mine={mineOf({ attended: true })} />
        <MineFacts mine={mineOf()} />
        <FeeBlock mine={mineOf()} />
      </div>
      <QrCode text={QR_TEXT} label="QR 예시" />
    </Section>
  )
}
