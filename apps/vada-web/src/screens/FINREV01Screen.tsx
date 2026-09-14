import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import type { ScopeDraft } from '../state/scopes'
import { PurchaseReviewActions } from './purchase-review/PurchaseReviewActions'
import { PurchaseReviewHeader } from './purchase-review/PurchaseReviewHeader'
import { PurchaseReviewTable } from './purchase-review/PurchaseReviewTable'
import { BREADCRUMB_SEPARATORS, SCREEN, scalar } from './purchase-review/spec'
import { usePurchaseReviewDraft } from './purchase-review/usePurchaseReviewDraft'

interface FINREV01ScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 구매 요청 검토 모델과 검토 화면의 세 영역을 조립한다. */
export function FINREV01Screen(props: FINREV01ScreenProps) {
  const model = usePurchaseReviewDraft(props)
  const shell = {
    screenId: model.screen.screenId,
    activeNavigationScreenId: model.screen.activeNavigationScreenId,
    eyebrow: model.screen.meta?.eyebrow,
    title: model.screen.meta?.title ?? model.screen.screenId,
  }
  if (!model.ready) {
    return (
      <AppShell {...shell} onNavigate={props.onNavigate}>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }
  return (
    <AppShell
      {...shell}
      onNavigate={props.onNavigate}
      breadcrumb={
        model.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(model.summaryRow, item.field),
            )}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-8 py-6">
        <PurchaseReviewHeader model={model} />
        <PurchaseReviewTable model={model} />
        <PurchaseReviewActions model={model} />
      </div>
    </AppShell>
  )
}
