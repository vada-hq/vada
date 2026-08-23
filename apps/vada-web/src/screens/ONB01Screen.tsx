import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { renderField } from '../spec/elements'
import { useFieldDraft } from '../spec/useFieldDraft'
import {
  findButtonSpec,
  findInputSpec,
  findSelectSpec,
  navigateTarget,
  nodeIdOf,
  onb01,
} from '../spec/screens'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface ONB01ScreenProps {
  draft: ScopeDraft
  scopes: ScopeStore
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

export function ONB01Screen({ draft, scopes, onChangeDraft, onNavigate }: ONB01ScreenProps) {
  const nextButtonSpec = findButtonSpec(onb01)
  const meta = onb01.meta

  const field = useFieldDraft({ elements: onb01.elements, draft, onChangeDraft })

  // 이 화면은 명세의 순서를 그대로 쌓지 않는다. design 7:22·7:32가 필드를 두
  // 묶음으로 나누고 이름·학번을 두 칸으로 놓는데, 그 묶음이 아직 스펙에 없다
  // (group 요소가 없다 — 마찰 로그). 그래서 자리는 여기가 정하고, 무엇을 그릴지는
  // 부품 표가 정한다.
  const context = { screen: onb01, draft, scopes, field }
  const drawField = (fieldKey: string, kind: 'input' | 'select') =>
    renderField(
      context,
      kind === 'input' ? findInputSpec(onb01, fieldKey) : findSelectSpec(onb01, fieldKey),
    )

  function handleNext() {
    field.runButton(nextButtonSpec, () => onNavigate(navigateTarget(nextButtonSpec.action)))
  }

  return (
    <PageCard screen={onb01}>
      {/* 폼 7:21: pt 21→24, 섹션 간 gap 17.5→20 */}
      <div className="flex flex-col gap-5 pt-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500">기본 프로필</h2>
          <div className="grid grid-cols-2 gap-3">
            {drawField('name', 'input')}
            {drawField('studentNumber', 'input')}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500">학적 정보</h2>
          {drawField('school', 'select')}
          {drawField('college', 'select')}
          {drawField('department', 'select')}
          {drawField('currentGrade', 'select')}
        </section>
      </div>

      {/* 버튼 7:76: pt 28→32 / 안내 7:82: pt 7→8 */}
      <div className="pt-8">
        <PrimaryButton
          label={nextButtonSpec.label}
          nodeId={nodeIdOf(onb01, nextButtonSpec)}
          onClick={handleNext}
        />
        {meta?.footerNote && (
          <p className="pt-2 text-center text-xs text-gray-400">{meta.footerNote}</p>
        )}
      </div>
    </PageCard>
  )
}
