import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EvidenceCompletionActions } from './finance-evidence/EvidenceCompletionActions'
import { EvidencePaymentList } from './finance-evidence/EvidencePaymentList'
import { EvidenceSummary } from './finance-evidence/EvidenceSummary'
import { BREADCRUMB_SEPARATORS, SCREEN } from './finance-evidence/spec'
import {
  useFinanceEvidence,
  type FinanceEvidenceProps,
} from './finance-evidence/useFinanceEvidence'

// 결제·증빙 정리(FIN-EVID-01). 요약, 결제 목록, 완료 동작을 조립한다.
export function FINEVID01Screen(props: FinanceEvidenceProps) {
  const model = useFinanceEvidence(props)
  if (!model.ready) {
    return (
      <AppShell
        screenId={model.screen.screenId}
        activeNavigationScreenId={model.screen.activeNavigationScreenId}
        eyebrow={model.screen.meta?.eyebrow}
        title={model.screen.meta?.title ?? model.screen.screenId}
        onNavigate={props.onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      onNavigate={model.onNavigate}
      breadcrumb={
        model.breadcrumbItems === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb!.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-6">
        <EvidenceSummary model={model} />
        <EvidencePaymentList model={model} />
        <EvidenceCompletionActions model={model} />
      </div>
    </AppShell>
  )
}
