import { FigmaAsset } from '../components/FigmaAsset'
import type { ScopeDraft } from '../state/scopes'
import { EventBasicsForm } from './event-basics-editor/EventBasicsForm'
import { EventBasicsPanel } from './event-basics-editor/EventBasicsPanel'
import { ASSET, NODE, SCREEN } from './event-basics-editor/spec'
import { useEventBasicsDraft } from './event-basics-editor/useEventBasicsDraft'

interface EVT02BScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

/** 행사 개요 위에 기본정보 편집 모델과 패널 UI를 조립한다. */
export function EVT02BScreen(props: EVT02BScreenProps) {
  const model = useEventBasicsDraft(props)

  return (
    <EventBasicsPanel
      screenParams={props.screenParams}
      onClose={() => model.goBack(model.specs.close)}
    >
      {model.missing.length > 0 ? (
        <p role="alert" className="px-6 py-6 text-sm text-red-700">
          {model.missing.map((param) => param.missingNote).join(' ')}
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <span data-node-id={NODE.head}>
              <h2 className="text-sm font-semibold text-gray-900">{model.specs.head.title}</h2>
              <p className="pt-0.5 text-xs text-gray-400">{model.specs.head.description}</p>
            </span>
            <button
              type="button"
              data-node-id={NODE.close}
              aria-label={model.specs.close.label}
              onClick={() => model.goBack(model.specs.close)}
              className="shrink-0 rounded p-1 hover:bg-gray-50"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-3.5" />
            </button>
          </div>
          <EventBasicsForm model={model} />
        </>
      )}
    </EventBasicsPanel>
  )
}
