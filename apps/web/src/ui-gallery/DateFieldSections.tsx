import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { DateField } from '@/components/ui/date-field'
import { DateTimeField, TimeField } from '@/components/ui/date-time-field'
import { Field } from '@/components/ui/field'
import { Section } from './GallerySection'
import { today } from './home-frame-samples'

function DateSample({
  label,
  initial,
  optional,
  error,
}: {
  label: string
  initial: string
  optional?: boolean
  error?: string
}) {
  const [value, setValue] = useState(initial)
  return (
    <Field label={label} optional={optional ?? false} required={!optional} error={error}>
      <DateField today={today} value={value} clearable={optional} onChange={setValue} />
    </Field>
  )
}

function DateTimeSample({ initial, error }: { initial: string; error?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <Field label="시작 일시" optional error={error}>
      <DateTimeField
        today={today}
        timeLabel="시작 시각"
        clearable
        value={value}
        onChange={setValue}
      />
    </Field>
  )
}

function TimeSample() {
  const [value, setValue] = useState('14:00')
  return (
    <Field label="시작" required>
      <TimeField value={value} onChange={setValue} />
    </Field>
  )
}

// 앱 달력으로 고르는 날짜 칸과 날짜+시각 칸(빈 값, 값 있음, 올해 아닌 날, 문제). 누르면 칸 아래에 달력이 뜬다.
// 휴대폰 폭(640px 미만)에서는 같은 달력이 아래 시트로 올라오고 날 칸이 44px다(오른쪽 견본).
export function DateFieldSection() {
  return (
    <Section title="날짜 칸">
      <div className="flex w-72 flex-col gap-3">
        <DateSample label="결제일" initial="" />
        <DateSample label="필요한 때" initial="2026-11-03" optional />
        <DateSample label="임기 끝" initial="2027-02-28" />
        <DateSample label="끝일" initial="" error="끝일을 입력해 주세요" />
      </div>
      <div className="flex w-80 flex-col gap-3">
        <DateTimeSample initial="" />
        <DateTimeSample initial="2026-10-24T14:00" />
        <DateTimeSample initial="" error="시작 일시를 입력해 주세요" />
        <TimeSample />
      </div>
      <div className="flex w-72 flex-col gap-2 rounded-md border bg-white p-1 shadow-lg">
        <Calendar value="2026-10-24" today={today} max={today} onSelect={() => {}} />
      </div>
      <div className="flex w-97.5 flex-col rounded-t-xl border bg-white pb-4 shadow-2xl">
        <p className="px-6 pt-5 pb-1 text-base font-semibold text-fg">날짜 선택</p>
        <div className="flex justify-center">
          <Calendar value="2026-10-24" today={today} touch onSelect={() => {}} />
        </div>
      </div>
    </Section>
  )
}
