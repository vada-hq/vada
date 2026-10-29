import {
  REGISTRATION_STATUSES,
  type Applicant,
  type EventApplicant,
  type EventApplicantsResponse,
  type RegistrationForm,
} from '@vada/contracts'
import { ApplicantRow } from '@/registrations/ApplicantRow'
import { FormCard } from '@/registrations/FormCard'
import { eventDetail } from '@/test-support/event-fixtures'
import { EventApplicantsView } from '@/registrations/EventApplicantsView'
import { Section } from './GallerySection'
import { sampleAnswers } from './question-samples'
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
  collectsStudentId: true,
  paused: false,
  publicCode: 'ABCD2345',
  questions: [],
  payerFee: 5000,
  nonPayerFee: 10000,
  feeAccount: null,
  status: 'open',
  applicantCount: 12,
  attendedCount: 0,
  remaining: 38,
  purgeOn: '2027-10-24',
  missingConditions: [],
  actions: ['form.update', 'form.pause', 'form.check_in', 'form.view_applicants'],
  ...extra,
})

const noop = () => {}
const handlers = { onForbidden: noop, onLost: noop }
const galleryEvent = eventDetail({ id: '00000000-0000-4000-8000-000000000401' }, ['event.update'])

// 초안(빠진 계좌)과 활성 양식 카드를 같은 화면 구성으로 비교한다. 미리보기까지 열 수 있는 UUID 견본이다.
export function RegistrationReceptionSection() {
  const event = galleryEvent
  const active = form('00000000-0000-4000-8000-000000000402', {
    eventId: event.id,
    feeAccount: { id: '00000000-0000-4000-8000-000000000403', name: '행사 참가비 통장' },
    closesAt: '2026-11-01T18:00',
  })
  const draft = {
    ...active,
    id: '00000000-0000-4000-8000-000000000404',
    paused: true,
    status: 'paused' as const,
    feeAccount: null,
    applicantCount: 0,
    remaining: active.capacity,
    missingConditions: ['fee_account'] as RegistrationForm['missingConditions'],
    actions: ['form.update', 'form.activate'] as RegistrationForm['actions'],
  }
  return (
    <Section title="신청 받기 · 초안·활성">
      <div className="flex w-full min-w-0 flex-col gap-8">
        {[draft, active].map(data => (
          <FormCard
            key={data.id}
            councilId="00000000-0000-4000-8000-000000000405"
            councilName="한양대학교 학생회"
            event={event}
            form={data}
            onEdit={noop}
            onEditEvent={noop}
            onChanged={noop}
            {...handlers}
          />
        ))}
      </div>
    </Section>
  )
}

function Card({ data }: { data: RegistrationForm }) {
  return (
    <FormCard
      councilId="c1"
      councilName="한양대학교 학생회"
      event={galleryEvent}
      form={data}
      onEdit={noop}
      onEditEvent={noop}
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
  actions: ['registration.check_in', 'registration.cancel', 'deposit.confirm'],
  ...extra,
})

// 신청자 줄: 입금 안 함, 입금 확인, 환불 대기(취소함), 참가비 없음, 긴 이름. 390px 폭에서 본다.
export function ApplicantRowSection() {
  const rows = [
    applicant('none', {}),
    applicant('paid', {
      deposit: { status: 'confirmed', amount: 5000 },
      actions: ['registration.check_in', 'registration.cancel', 'deposit.cancel'],
    }),
    applicant('refund', {
      cancelled: true,
      deposit: { status: 'refund_pending', amount: 5000 },
      actions: ['deposit.cancel', 'deposit.refund'],
    }),
    applicant('free', {
      appliedFee: 0,
      payer: null,
      actions: ['registration.check_in', 'registration.cancel'],
    }),
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
            onChange={noop}
            onGone={noop}
            {...handlers}
          />
        ))}
      </ul>
    </Section>
  )
}

// 신청 양식 카드(상태 다섯, 권한 없음, 긴 이름). 390px 폭에서 본다. QR 스캐너의 결과 카드는 ScanVerdictSection에 있다.
export function RegistrationSection() {
  return (
    <Section title="신청 양식 카드·상태">
      <div className="flex w-96 max-w-full flex-col gap-2">
        {REGISTRATION_STATUSES.map(status => (
          <Card
            key={status}
            data={form(status, {
              status,
              paused: status === 'paused',
              // 마감한 양식은 멈추기·다시 받기가 없다(RULE-43).
              ...(status === 'paused' && {
                actions: ['form.update', 'form.resume', 'form.check_in', 'form.view_applicants'],
              }),
              ...(status === 'closed' && {
                actions: ['form.update', 'form.check_in', 'form.view_applicants'],
              }),
            })}
          />
        ))}
        <Card data={form('view', { actions: [], capacity: null, opensAt: '2026-10-22T09:00' })} />
        <Card data={form('long', { name: `${unbroken} ${longName}` })} />
      </div>
    </Section>
  )
}

const eventRows: EventApplicant[] = [
  {
    ...applicant('00000000-0000-4000-8000-000000000101', {}),
    formId: '00000000-0000-4000-8000-000000000201',
    formTitle: '재학생 참가 신청',
    affiliation: null,
    answers: sampleAnswers,
    needsAttention: false,
  },
  {
    ...applicant('00000000-0000-4000-8000-000000000102', {
      name: '이확인',
      studentId: '20260002',
      duplicateStudentId: true,
    }),
    formId: '00000000-0000-4000-8000-000000000202',
    formTitle: '신입생 참가 신청',
    affiliation: null,
    answers: [],
    needsAttention: true,
  },
  {
    ...applicant('00000000-0000-4000-8000-000000000103', {
      name: `${longName} ${unbroken}`,
      studentId: '20260003',
      attended: true,
      deposit: { status: 'confirmed', amount: 5000 },
      actions: ['registration.cancel_check_in', 'deposit.cancel'],
    }),
    formId: '00000000-0000-4000-8000-000000000201',
    formTitle: '재학생 참가 신청',
    affiliation: null,
    answers: [],
    needsAttention: false,
  },
]

const eventList: EventApplicantsResponse = {
  applicants: eventRows,
  counts: { applicants: 53, attended: 1 },
  total: 53,
  page: 1,
  canView: true,
  canManage: true,
  showAffiliation: false,
  showForm: true,
  accessToken: null,
}

// 1280px·420px에서 표/줄 목록, 읽기 권한만 있음, 개인정보 권한 없음, 일괄 부분 실패를 맞대 본다.
export function EventApplicantsSection() {
  const failedId = eventRows[1]!.id
  return (
    <Section title="행사 참가자 표·일괄 처리">
      <div className="flex w-full min-w-0 flex-col gap-6">
        <EventApplicantsView councilId="c1" data={eventList} />
        <EventApplicantsView
          councilId="c1"
          data={{
            ...eventList,
            canManage: false,
            applicants: eventRows.map(row => ({ ...row, actions: [] })),
          }}
        />
        <EventApplicantsView
          councilId="c1"
          data={{
            ...eventList,
            applicants: [],
            total: 0,
            canView: false,
            canManage: false,
            showForm: false,
          }}
        />
        <div className="w-105 max-w-full">
          <EventApplicantsView
            councilId="c1"
            data={eventList}
            selected={new Set([failedId])}
            result={{
              results: [
                { registrationId: eventRows[0]!.id, error: null },
                { registrationId: failedId, error: 'DEPOSIT_EXISTS' },
              ],
            }}
          />
        </div>
      </div>
    </Section>
  )
}
