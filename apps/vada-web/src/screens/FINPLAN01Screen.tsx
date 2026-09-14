import { AppShell } from '../components/AppShell'
import { getMutation } from '../spec/mutations'
import { drawnTitleOf, finPlan01 } from '../spec/screens'
import type { SubmitAction } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { BudgetPlanSections } from './budget-plan-editor/BudgetPlanSections'
import { NODE } from './budget-plan-editor/spec'
import { useBudgetPlanDraft } from './budget-plan-editor/useBudgetPlanDraft'

interface FINPLAN01ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

/** 예산 편성 초안 모델과 편성 섹션을 조립한다. */
export function FINPLAN01Screen({
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: FINPLAN01ScreenProps) {
  const model = useBudgetPlanDraft({
    scopeDraft: draft,
    onChangeDraft,
    onNavigate,
    onScopeEvent,
  })

  return (
    <AppShell
      screenId={finPlan01.screenId}
      activeNavigationScreenId={finPlan01.activeNavigationScreenId}
      title={drawnTitleOf(finPlan01)}
      headerAction={
        <div className="flex items-center gap-2">
          {[NODE.cancel, NODE.save].map((nodeId) => {
            const spec = model.specs.buttonAt(nodeId)
            const running =
              spec.action.type === 'submit' &&
              model.submitAction.runningKey === spec.action.mutationKey
            return (
              <button
                key={nodeId}
                type="button"
                data-node-id={nodeId}
                onClick={() => model.pressButton(spec)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {running
                  ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting
                  : spec.label}
              </button>
            )
          })}
        </div>
      }
      onNavigate={onNavigate}
    >
      <div className="flex flex-col gap-6">
        <div data-node-id={NODE.heading}>
          <h2 className="text-lg font-semibold text-gray-900">{model.specs.heading.title}</h2>
          <p className="pt-1 text-sm text-gray-500">{model.specs.heading.description}</p>
        </div>

        {model.submitAction.errorMessage === null ? null : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {model.submitAction.errorMessage}
          </p>
        )}
        {model.blockedKeys.length === 0 ? null : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
            {`아직 채우지 않은 칸이 있습니다: ${model.blockedKeys
              .map((key) => model.labelOfField(key))
              .join(', ')}`}
          </p>
        )}
        {model.note === null ? null : (
          <p role="status" className="text-xs font-medium text-gray-500">
            {model.note}
          </p>
        )}

        <BudgetPlanSections model={model} />
      </div>
    </AppShell>
  )
}
