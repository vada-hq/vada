import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { renderBody } from '../spec/elements'
import {
  buttonsByEmphasis,
  inv01,
  navigateTarget,
  nodeIdOf,
  primaryButtonOf,
} from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import type { ButtonSpec } from '../spec/types'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface INV01ScreenProps {
  draft: ScopeDraft
  scopes: ScopeStore
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

export function INV01Screen({ draft, scopes, onChangeDraft, onNavigate }: INV01ScreenProps) {
  const meta = inv01.meta
  const elements = inv01.elements
  const field = useFieldDraft({ elements, draft, onChangeDraft })

  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const quietButtons = buttonsByEmphasis(buttons, 'quiet')

  // 묶음이 테두리 상자다(14:35) — ORG-01의 채움과 다른 design의 사실이라 화면이 고른다.
  const body = renderBody(
    { screen: inv01, draft, scopes, field },
    { groupVariant: 'outlined' },
  )

  return (
    // 머리는 로고뿐이다 — 흐름에 속하지 않아 진행 표시가 없고(14:6), design에
    // 화면 제목도 없다(spec/screens.ts의 drawsTitle). 둘 다 PageCard가 안다.
    <PageCard screen={inv01}>
      {/* 카드 14:12부터 세로로 쌓인다. 섹션 간 간격 21→pt-6. */}
      <div className="flex flex-col gap-6 pt-6">{body}</div>

      {meta?.footerNote && <p className="pt-5 text-xs text-gray-400">{meta.footerNote}</p>}

      <div className="flex flex-col gap-2 pt-4">
        <PrimaryButton
          label={primaryButton.label}
          nodeId={nodeIdOf(inv01, primaryButton)}
          onClick={() =>
            field.runButton(primaryButton, () => onNavigate(navigateTarget(primaryButton.action)))
          }
        />
        {quietButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            data-node-id={nodeIdOf(inv01, button)}
            onClick={() => onNavigate(navigateTarget(button.action))}
            className="rounded px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {button.label}
          </button>
        ))}
      </div>
    </PageCard>
  )
}
