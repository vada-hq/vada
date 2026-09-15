import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { finReq02 } from '../spec/screen-specs/finReq02'
import { FINANCE_REQUEST_BREADCRUMB_SEPARATORS } from './finance-request-detail/config'
import { FinanceRequestDetailView } from './finance-request-detail/FinanceRequestDetailView'
import { useFinanceRequestDetail } from './finance-request-detail/useFinanceRequestDetail'

interface FINREQ02ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function FINREQ02Screen({ screenParams, onNavigate }: FINREQ02ScreenProps) {
  const model = useFinanceRequestDetail(screenParams, onNavigate)
  const meta = finReq02.meta
  if (meta === undefined) {
    throw new Error('FIN-REQ-02의 화면 카피가 없습니다.')
  }

  return (
    <AppShell
      screenId={finReq02.screenId}
      activeNavigationScreenId={finReq02.activeNavigationScreenId}
      title={model.title}
      eyebrow={meta.eyebrow}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        model.ready && model.breadcrumb !== undefined ? (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={finReq02.screenId}
            separatorNodeIds={FINANCE_REQUEST_BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems ?? []}
          />
        ) : undefined
      }
      onNavigate={onNavigate}
    >
      {model.ready ? <FinanceRequestDetailView model={model} /> : <p role="alert">{model.message}</p>}
    </AppShell>
  )
}
