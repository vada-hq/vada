import type { ReactNode } from 'react'
import type { MeetingOptionsResponse } from '@vada/contracts'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/use-form-check'
import type { MeetingFormValue } from './meeting-form'

export type MeetingFieldsProps = {
  value: MeetingFormValue
  errors: FieldErrors
  onChange: (patch: Partial<MeetingFormValue>) => void
}
export function FormSection({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-blue-50 text-sm text-blue-700">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  )
}
export function MeetingTypeFields({
  value,
  errors,
  onChange,
  options,
}: MeetingFieldsProps & { options: MeetingOptionsResponse }) {
  return (
    <FormSection number="1" title="회의 유형">
      <RadioGroup
        aria-label="회의 유형"
        className="grid gap-3 sm:grid-cols-2"
        value={value.type}
        onValueChange={type =>
          onChange({ type: type === 'event' ? 'event' : 'council', eventId: '' })
        }
      >
        <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-sm border p-4 text-sm has-[[data-state=checked]]:border-blue-500 has-[[data-state=checked]]:bg-blue-50">
          <RadioGroupItem value="council" />
          정기·상시 회의
        </Label>
        <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-sm border p-4 text-sm has-[[data-state=checked]]:border-blue-500 has-[[data-state=checked]]:bg-blue-50">
          <RadioGroupItem value="event" />
          행사 관련 회의
        </Label>
      </RadioGroup>
      {value.type === 'event' && (
        <Field label="연결 행사" required error={errors.eventId}>
          <NativeSelect
            className="max-sm:min-h-11"
            value={value.eventId}
            onChange={event => onChange({ eventId: event.target.value })}
          >
            <option value="">행사 선택</option>
            {options.events.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    </FormSection>
  )
}
export function MeetingBasicFields({
  value,
  errors,
  onChange,
  options,
  creatorName,
}: MeetingFieldsProps & { options: MeetingOptionsResponse; creatorName: string }) {
  return (
    <FormSection number="2" title="기본 정보">
      <Field label="회의명" required error={errors.title}>
        <Input
          className="max-sm:min-h-11"
          value={value.title}
          onChange={event => onChange({ title: event.target.value })}
        />
      </Field>
      <div>
        <p className="text-xs text-muted-foreground">주최자</p>
        <p className="mt-2 wrap-anywhere text-sm">{creatorName}</p>
      </div>
      <Field label="주관 부서" optional error={errors.hostDepartmentId}>
        <NativeSelect
          className="max-sm:min-h-11"
          value={value.hostDepartmentId}
          onChange={event => onChange({ hostDepartmentId: event.target.value })}
        >
          <option value="">학생회 전체</option>
          {options.departments.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="회의 목적" optional error={errors.purpose}>
        <Textarea
          value={value.purpose}
          onChange={event => onChange({ purpose: event.target.value })}
        />
      </Field>
    </FormSection>
  )
}
export function MeetingScheduleFields({ value, errors, onChange }: MeetingFieldsProps) {
  return (
    <FormSection number="3" title="일정과 장소">
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        <Field label="날짜" required error={errors.date}>
          <Input
            className="min-w-0 max-sm:min-h-11"
            type="date"
            value={value.date}
            onChange={event => onChange({ date: event.target.value })}
          />
        </Field>
        <Field label="시작" required error={errors.start}>
          <Input
            className="min-w-0 max-sm:min-h-11"
            type="time"
            value={value.start}
            onChange={event => onChange({ start: event.target.value })}
          />
        </Field>
        <Field label="끝" required error={errors.end}>
          <Input
            className="min-w-0 max-sm:min-h-11"
            type="time"
            value={value.end}
            onChange={event => onChange({ end: event.target.value })}
          />
        </Field>
      </div>
      <Field label="장소" required error={errors.place}>
        <Input
          className="max-sm:min-h-11"
          value={value.place}
          onChange={event => onChange({ place: event.target.value })}
        />
      </Field>
    </FormSection>
  )
}
