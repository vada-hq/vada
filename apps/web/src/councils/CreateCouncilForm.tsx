import type { MyCouncil } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import CouncilFields from './CouncilFields'
import { operatingYearError } from './term'
import { useCreateCouncil } from './useCreateCouncil'

type Props = { onCreated: (council: MyCouncil) => void; onCancel: () => void }

// 학생회 만들기(바탕 spec G6): 이름, 단위, 학교, 운영 연도.
export default function CreateCouncilForm({ onCreated, onCancel }: Props) {
  const { form, set, years, refreshYears, yearError, saving, error, parsed, submit } =
    useCreateCouncil(onCreated)
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() =>
    withContract(
      {
        name: requiredText(form.name, '학생회 이름을'),
        schoolName: requiredText(form.schoolName, '학교를'),
        year: operatingYearError(form.year),
      },
      parsed,
    ),
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="학생회 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        refreshYears()
        if (attempt()) void submit(event)
      }}
    >
      <h2 className="text-lg font-semibold">학생회 만들기</h2>
      <CouncilFields
        form={form}
        set={set}
        years={years}
        errors={{ ...fieldErrors, year: fieldErrors.year ?? yearError }}
      />
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" busy={saving} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="flex-1" busy={saving}>
          {saving ? '만드는 중…' : '학생회 만들기'}
        </Button>
      </div>
    </form>
  )
}
