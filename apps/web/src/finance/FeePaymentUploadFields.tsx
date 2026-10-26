import { useRef, useState } from 'react'
import type { FiscalPeriodSummary } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/use-form-check'
import { dayLabel } from '@/lib/korean-date-text'
import { FEE_PAYMENT_FILE_ERROR, readFeePaymentFile } from './fee-payment-file'

export type FeePaymentValues = { paidFrom: string; paidUntil: string; students: string }

type Props = {
  values: FeePaymentValues
  periods: FiscalPeriodSummary[]
  selected: string
  saving: boolean
  errors: FieldErrors
  onSelect: (id: string) => void
  onChange: (values: FeePaymentValues) => void
  onReading: (reading: boolean) => void
}

function StudentFile({
  onStudents,
  onReading,
  saving,
}: {
  onStudents: (students: string) => void
  onReading: (reading: boolean) => void
  saving: boolean
}) {
  const [error, setError] = useState<string>()
  const revision = useRef(0)
  async function read(file: File | undefined) {
    const current = ++revision.current
    setError(undefined)
    onStudents('')
    if (!file) {
      onReading(false)
      return
    }
    onReading(true)
    try {
      const students = await readFeePaymentFile(file)
      if (current === revision.current) onStudents(students)
    } catch {
      if (current === revision.current) setError(FEE_PAYMENT_FILE_ERROR)
    } finally {
      if (current === revision.current) onReading(false)
    }
  }
  return (
    <Field label="명단 파일" optional hint="UTF-8 CSV·TSV의 학번 열만 읽어요." error={error}>
      <Input
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        disabled={saving}
        className="max-sm:min-h-11"
        onChange={event => void read(event.target.files?.[0])}
      />
    </Field>
  )
}

export function FeePaymentUploadFields({
  values,
  periods,
  selected,
  saving,
  errors,
  onSelect,
  onChange,
  onReading,
}: Props) {
  return (
    <>
      <Field label="학기" required>
        <NativeSelect
          className="max-sm:min-h-11"
          value={selected}
          disabled={saving}
          onChange={event => onSelect(event.target.value)}
        >
          {periods.map(period => (
            <option key={period.id} value={period.id}>
              {period.name}
            </option>
          ))}
          <option value="manual">직접 입력</option>
        </NativeSelect>
      </Field>
      {selected === 'manual' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="납부 시작일" required error={errors.paidFrom}>
            <Input
              type="date"
              className="max-sm:min-h-11"
              value={values.paidFrom}
              disabled={saving}
              onChange={event => onChange({ ...values, paidFrom: event.target.value })}
            />
          </Field>
          <Field label="납부 끝일" required error={errors.paidUntil}>
            <Input
              type="date"
              className="max-sm:min-h-11"
              value={values.paidUntil}
              disabled={saving}
              onChange={event => onChange({ ...values, paidUntil: event.target.value })}
            />
          </Field>
        </div>
      ) : (
        <p className="text-sm break-keep text-muted-foreground">
          {dayLabel(values.paidFrom)} ~ {dayLabel(values.paidUntil)}
        </p>
      )}
      <StudentFile
        saving={saving}
        onReading={onReading}
        onStudents={students => onChange({ ...values, students })}
      />
      <Field label="학번" required hint="줄바꿈이나 쉼표로 구분" error={errors.students}>
        <Textarea
          rows={6}
          value={values.students}
          disabled={saving}
          onChange={event => onChange({ ...values, students: event.target.value })}
        />
      </Field>
    </>
  )
}
