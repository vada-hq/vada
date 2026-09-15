import { AppShell } from '../components/AppShell'
import { drawnTitleOf } from '../spec/screens'
import { finReq01 } from '../spec/screen-specs/finReq01'
import type { ScopeDraft } from '../state/scopes'
import { PurchaseRequestForm } from './purchase-request-editor/PurchaseRequestForm'
import { PurchaseRequestSidebar } from './purchase-request-editor/PurchaseRequestSidebar'
import { usePurchaseRequestDraft } from './purchase-request-editor/usePurchaseRequestDraft'

interface FINREQ01ScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

/** 구매 요청 초안 모델과 기본정보·품목·요약 영역을 조립한다. */
export function FINREQ01Screen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: FINREQ01ScreenProps) {
  const model = usePurchaseRequestDraft({
    screenParams,
    scopeDraft: draft,
    onChangeDraft,
    onNavigate,
    onScopeEvent,
  })
  const missing = (finReq01.params ?? []).filter(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={finReq01.screenId}
        activeNavigationScreenId={finReq01.activeNavigationScreenId}
        title={finReq01.meta?.title ?? finReq01.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={finReq01.screenId}
      activeNavigationScreenId={finReq01.activeNavigationScreenId}
      title={drawnTitleOf(finReq01, screenParams)}
      onNavigate={onNavigate}
    >
      <div className="flex gap-6">
        <PurchaseRequestForm model={model} />
        <PurchaseRequestSidebar model={model} />
      </div>
    </AppShell>
  )
}
