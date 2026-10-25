import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useFormCheck } from '@/lib/use-form-check'
import { structureErrors } from './council-draft'
import { CreateStepHeader } from './CreateStepHeader'
import DepartmentTree from './DepartmentTree'
import PresidentCard from './PresidentCard'
import type { CouncilDraftState } from './useCouncilDraft'

type Props = {
  draft: CouncilDraftState
  linkedName: string | null
  saving: boolean
  error: string
  onBack: () => void
  // 칸 확인을 지난 뒤에만 부른다.
  onSubmit: () => void
  // 그사이 해가 바뀌어 운영 연도가 선택지 밖이면 보내지 않고 1단계로 돌아가 그 칸 아래에 알린다.
  onYearReset: () => void
}

// 학생회 만들기 2/3 조직 구조: 회장단 카드에서 부서 카드로 갈라지는 조직도(와이어프레임 ORG-02). [학생회 만들기]가 한 요청으로 학생회와 부서를 만든다.
export default function CreateStructureStep({ draft, linkedName, saving, error, ...on }: Props) {
  const askName = linkedName === null
  const { formRef, errors, attempt } = useFormCheck(() =>
    structureErrors(draft.draft, draft.parse(askName), askName),
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="학생회 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (saving) return
        if (draft.refreshYears()) return on.onYearReset()
        if (attempt()) on.onSubmit()
      }}
    >
      <CreateStepHeader step="조직 구조" />
      {/* 회장단 카드와 부서 조직도는 선으로 이어지므로 틈 없이 붙인다. */}
      <div className="flex flex-col">
        <PresidentCard
          linkedName={linkedName}
          memberName={draft.draft.memberName}
          error={errors.memberName}
          onChange={draft.set('memberName')}
        />
        <DepartmentTree
          draft={draft.draft}
          set={draft.set}
          renameDepartment={draft.renameDepartment}
          removeDepartment={draft.removeDepartment}
          addDepartment={draft.addDepartment}
          errors={errors}
        />
      </div>
      <div className="flex flex-col gap-2">
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" touch busy={saving} onClick={on.onBack}>
            이전
          </Button>
          <Button type="submit" touch className="flex-1" busy={saving}>
            {saving ? '만드는 중…' : '학생회 만들기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
