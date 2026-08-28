import { FigmaAsset } from '../components/FigmaAsset'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { renderField } from '../spec/elements'
import {
  buttonsByEmphasis,
  inv00,
  navigateTarget,
  nodeIdOf,
  primaryButtonOf,
} from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import type { ButtonSpec, FieldSpec } from '../spec/types'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

// 초대 코드 입력(INV-00).
//
// ONB-02의 '초대받은 학생회 참여하기'가 여는 칸이고, 코드가 찾아낸 학생회를
// 보여주는 다음 칸이 INV-01이다. 코드는 화면 안의 useState가 아니라
// onboardingDraft에 담긴다 — INV-01이 같은 스코프를 쓰므로 넘어가서도 남는다.
//
// **와이어프레임의 '→ 오류 예시: …' 넉 줄(14:375·14:377·14:379·14:381)은
// 그리지 않는다.** 가리키는 프레임이 저장소에 하나도 없는 시연 장치다
// (OPS-MEET-06B의 '실패 상태 미리보기'와 같은 판정). 옮기면 없는 기능이
// 계약에 들어간다. 그 어긋남은 숨기지 않고 design/deviations.ts에 적는다.
//
// **흐름 표시('시작 방식 선택 2 / 2')도 그려지지 않는다.** flows.json은 단계
// 번호를 배열 위치로 세는데, 그림은 ONB-02와 이 화면에 같은 '2 / 2'를 적어
// 두었다 — 한 단계에 화면이 둘이라는 말을 카탈로그가 아직 못 한다.

const SCREEN = 'INV-00'

const ASSET = {
  back: '14:389',
} as const

interface INV00ScreenProps {
  draft: ScopeDraft
  scopes: ScopeStore
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

export function INV00Screen({ draft, scopes, onChangeDraft, onNavigate }: INV00ScreenProps) {
  const elements = inv00.elements
  const field = useFieldDraft({ elements, draft, onChangeDraft })

  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const quietButtons = buttonsByEmphasis(buttons, 'quiet')

  const fields = elements
    .map((element) => element.spec)
    .filter((spec): spec is FieldSpec => spec.type === 'input' || spec.type === 'select')

  return (
    // 머리는 로고뿐이다(meta.eyebrow가 없다). 제목·설명은 PageCard가 명세에서 읽는다.
    <PageCard screen={inv00}>
      <div className="flex flex-col gap-6 pt-6">
        {fields.map((spec) => renderField({ screen: inv00, draft, scopes, field }, spec))}
      </div>

      <div className="flex flex-col gap-2 pt-6">
        {/* design 14:384는 화살표 없이 글만 있는 채운 단추다. */}
        <PrimaryButton
          label={primaryButton.label}
          nodeId={nodeIdOf(inv00, primaryButton)}
          trailingArrow={false}
          onClick={() =>
            field.runButton(primaryButton, () => onNavigate(navigateTarget(primaryButton.action)))
          }
        />
        {quietButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            data-node-id={nodeIdOf(inv00, button)}
            onClick={() => onNavigate(navigateTarget(button.action))}
            className="flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
            {button.label}
          </button>
        ))}
      </div>
    </PageCard>
  )
}
