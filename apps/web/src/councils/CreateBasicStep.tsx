import { Button } from '@/components/ui/button'
import { useFormCheck } from '@/lib/use-form-check'
import { basicErrors } from './council-draft'
import CouncilFields from './CouncilFields'
import { CreateStepHeader } from './CreateStepHeader'
import type { CouncilDraftState } from './useCouncilDraft'

type Props = { draft: CouncilDraftState; onNext: () => void; onCancel: () => void }

// 학생회 만들기 1/3 기본 정보. [다음]은 누를 때 확인해 문제를 칸 아래에 보이고 첫 칸으로 옮긴다. [취소]는 아무것도 남기지 않는다.
export default function CreateBasicStep({ draft, onNext, onCancel }: Props) {
  const { formRef, errors, attempt } = useFormCheck(() =>
    basicErrors(draft.draft, draft.parse(false)),
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="학생회 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        draft.refreshYears()
        if (attempt()) onNext()
      }}
    >
      <CreateStepHeader step="기본 정보" />
      <CouncilFields
        draft={draft.draft}
        set={draft.set}
        years={draft.years}
        errors={{ ...errors, year: errors.year ?? draft.yearError }}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="flex-1">
          다음
        </Button>
      </div>
    </form>
  )
}
