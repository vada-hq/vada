import { FlowProgress } from '../components/FlowProgress'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { renderBody } from '../spec/elements'
import { findFlowStep } from '../spec/flows'
import { useFieldDraft } from '../spec/useFieldDraft'
import {
  buttonsByEmphasis,
  navigateTarget,
  nodeIdOf,
  org01,
  primaryButtonOf,
} from '../spec/screens'
import type { ButtonSpec } from '../spec/types'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface ORG01ScreenProps {
  draft: ScopeDraft
  scopes: ScopeStore
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

export function ORG01Screen({ draft, scopes, onChangeDraft, onNavigate }: ORG01ScreenProps) {
  const meta = org01.meta
  const flowStep = findFlowStep(org01.screenId)
  const elements = org01.elements

  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  // 주/보조는 명세의 emphasis가 말한다. 예전에는 배열 위치로 추측했는데
  // ORG-01의 '이전'처럼 다른 흐름으로 나가는 버튼에서 근거가 없었다.
  const primaryButton = primaryButtonOf(buttons)
  const secondaryButtons = buttonsByEmphasis(buttons, 'secondary')

  const field = useFieldDraft({ elements, draft, onChangeDraft })

  function handlePrimary() {
    field.runButton(primaryButton, () => onNavigate(navigateTarget(primaryButton.action)))
  }

  // 무엇을 그릴지는 부품 표가 정한다(spec/elements.tsx). 이 화면이 정하는 것은
  // 그것을 어디에 놓느냐뿐이다.
  const body = renderBody({ screen: org01, draft, scopes, field })

  return (
    <PageCard>
      {/* 헤더 14:155: 좌측 eyebrow+제목, 우측 진행 표시(로고 없음 — design의 사실) */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {meta?.eyebrow && <p className="text-xs text-gray-400">{meta.eyebrow}</p>}
          {meta && <h1 className="pt-1 text-lg font-semibold text-gray-900">{meta.title}</h1>}
        </div>
        {flowStep && (
          <FlowProgress label={flowStep.label} step={flowStep.step} totalSteps={flowStep.total} />
        )}
      </header>
      {meta?.description && <p className="pt-1 text-sm text-gray-500">{meta.description}</p>}

      {/* 폼 14:166: pt 21→24, 요소 간 gap 17.5→20 */}
      <div className="flex flex-col gap-5 pt-6">{body}</div>

      {/* 하단 14:225: pt 28→32, 좌우 양끝 배치 */}
      <div className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-2">
          {secondaryButtons.map((button) => (
            <SecondaryButton
              key={button.label}
              label={button.label}
              nodeId={nodeIdOf(org01, button)}
              onClick={() => onNavigate(navigateTarget(button.action))}
            />
          ))}
        </div>
        <div className="flex flex-col items-end gap-2">
          <PrimaryButton
            label={primaryButton.label}
            nodeId={nodeIdOf(org01, primaryButton)}
            onClick={handlePrimary}
            fullWidth={false}
          />
          {meta?.footerNote && (
            <p className="text-right text-xs text-gray-400">{meta.footerNote}</p>
          )}
        </div>
      </div>
    </PageCard>
  )
}
