import { useEffect, useState } from 'react'
import type { RegistrationForm, RegistrationFormsResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { EVENT_FAILED } from '@/lib/messages'
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
  questions: [],
  payerFee: 5000,
  nonPayerFee: 5000,
  feeAccount: null,
  status: 'open',
  applicantCount: 12,
  attendedCount: 0,
  remaining: null,
  purgeOn: '2027-10-24',
  missingConditions: [],
  actions: [],
  ...extra,
})

// 보내는 중 견본은 닫히지 않으므로 실제 응답이 오듯 잠시 뒤 저절로 닫는다(확인 대화상자 견본과 같다).
const BUSY_EXAMPLE_MS = 1500

const ready = (forms: RegistrationForm[]): PolledState<RegistrationFormsResponse> => ({
  kind: 'ready',
  data: { forms, truncated: false, actions: [] },
})

type Sample = {
  values: EventFieldValues
  forms: PolledState<RegistrationFormsResponse>
  saving?: boolean
  problem?: string
}

const filled = eventFieldsOf({
  name: '신입생 환영회',
  startsAt: '2026-10-24T14:00',
  endsAt: '2026-10-24T18:00',
  place: '대강당',
})

const SAMPLES: Record<'filled' | 'tbd' | 'saving' | 'failed', Sample> = {
  // 일시·장소가 있고 양식 하나(참가비 하나, 정원 없음)
  filled: { values: filled, forms: ready([form('f1', {})]) },
  // 끝·장소 미정, 긴 이름, 양식 둘(참가비 없음과 납부자 별도 금액)
  tbd: {
    values: { ...emptyEventFields, name: `${unbroken} ${longName}`, startsAt: '2026-11-03T10:00' },
    forms: ready([
      form('f1', { name: '1부 신청', capacity: 30, payerFee: null, nonPayerFee: null }),
      form('f2', { name: longName, capacity: 20, payerFee: 0, nonPayerFee: 3000 }),
    ]),
  },
  // 보내는 중: 칸과 버튼이 꺼지고 닫히지 않는다. 양식은 아직 읽는 중.
  saving: { values: filled, forms: { kind: 'loading' }, saving: true },
  // 저장 실패: 이유가 버튼 줄 바로 위에 있다. 양식 목록도 읽지 못했다.
  failed: { values: filled, forms: { kind: 'failed' }, problem: EVENT_FAILED },
}

function Opened({ sample, onClose }: { sample: Sample; onClose: () => void }) {
  const [values, setValues] = useState(sample.values)
  return (
    <EventEditPanel
      values={values}
      onValues={setValues}
      owner={{ id: 'p1', name: '김새내', current: true }}
      forms={sample.forms}
      parsed={{ success: true }}
      saving={sample.saving ?? false}
      problem={sample.problem ?? null}
      onSubmit={onClose}
      onClose={onClose}
      onOpenForms={onClose}
    />
  )
}

// 행사 기본정보 수정 패널(와이어프레임 EVT-02B). 실제 화면처럼 오른쪽에 높이 전체로 열리고, 640px 미만에서는 전체 화면이다.
export function EventEditSection() {
  const [open, setOpen] = useState<keyof typeof SAMPLES | null>(null)
  useEffect(() => {
    if (open !== 'saving') return
    const timer = setTimeout(() => setOpen(null), BUSY_EXAMPLE_MS)
    return () => clearTimeout(timer)
  }, [open])
  return (
    <Section title="행사 기본정보 수정 패널">
      <Button variant="outline" onClick={() => setOpen('filled')}>
        기본정보 수정 패널 열기
      </Button>
      <Button variant="outline" onClick={() => setOpen('tbd')}>
        미정·양식 둘 패널 열기
      </Button>
      <Button variant="outline" onClick={() => setOpen('saving')}>
        보내는 중 패널 열기
      </Button>
      <Button variant="outline" onClick={() => setOpen('failed')}>
        저장 실패 패널 열기
      </Button>
      {open && <Opened key={open} sample={SAMPLES[open]} onClose={() => setOpen(null)} />}
    </Section>
  )
}
