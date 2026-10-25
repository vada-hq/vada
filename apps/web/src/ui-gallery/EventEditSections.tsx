import { useState } from 'react'
import type { RegistrationForm, RegistrationFormsResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import type { PolledState } from '@/lib/use-polled-read'
import { emptyEventFields, eventFieldsOf, type EventFieldValues } from '@/events/event-fields'
import { EventEditPanel } from '@/events/EventEditPanel'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const form = (id: string, extra: Partial<RegistrationForm>): RegistrationForm => ({
  id,
  eventId: 'e1',
  name: '환영회 참가 신청',
  opensAt: null,
  closesAt: '2026-10-23T18:00',
  capacity: null,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  paused: false,
  publicCode: 'ABCD2345',
  payerFee: 5000,
  nonPayerFee: 5000,
  feeAccount: null,
  status: 'open',
  applicantCount: 12,
  attendedCount: 0,
  remaining: null,
  purgeOn: '2027-10-24',
  actions: [],
  ...extra,
})

const ready = (forms: RegistrationForm[]): PolledState<RegistrationFormsResponse> => ({
  kind: 'ready',
  data: { forms, truncated: false, actions: [] },
})

type Sample = { values: EventFieldValues; forms: PolledState<RegistrationFormsResponse> }

const SAMPLES: Record<'filled' | 'tbd', Sample> = {
  // 일시·장소가 있고 양식 하나(참가비 하나, 정원 없음)
  filled: {
    values: eventFieldsOf({
      name: '신입생 환영회',
      startsAt: '2026-10-24T14:00',
      endsAt: '2026-10-24T18:00',
      place: '대강당',
    }),
    forms: ready([form('f1', {})]),
  },
  // 끝·장소 미정, 긴 이름, 양식 둘(참가비 없음과 납부자 별도 금액)
  tbd: {
    values: { ...emptyEventFields, name: `${unbroken} ${longName}`, startsAt: '2026-11-03T10:00' },
    forms: ready([
      form('f1', { name: '1부 신청', capacity: 30, payerFee: null, nonPayerFee: null }),
      form('f2', { name: longName, capacity: 20, payerFee: 0, nonPayerFee: 3000 }),
    ]),
  },
}

function Opened({ sample, onClose }: { sample: Sample; onClose: () => void }) {
  const [values, setValues] = useState(sample.values)
  return (
    <EventEditPanel
      values={values}
      onValues={setValues}
      owner={{ id: 'p1', name: '김새내', current: true }}
      forms={sample.forms}
      valid
      saving={false}
      problem={null}
      onSubmit={onClose}
      onClose={onClose}
      onOpenForms={onClose}
    />
  )
}

// 행사 기본정보 수정 패널(와이어프레임 EVT-02B). 실제 화면처럼 오른쪽에 높이 전체로 열리고, 640px 미만에서는 전체 화면이다.
export function EventEditSection() {
  const [open, setOpen] = useState<keyof typeof SAMPLES | null>(null)
  return (
    <Section title="행사 기본정보 수정 패널">
      <Button variant="outline" onClick={() => setOpen('filled')}>
        기본정보 수정 패널 열기
      </Button>
      <Button variant="outline" onClick={() => setOpen('tbd')}>
        미정·양식 둘 패널 열기
      </Button>
      {open && <Opened key={open} sample={SAMPLES[open]} onClose={() => setOpen(null)} />}
    </Section>
  )
}
