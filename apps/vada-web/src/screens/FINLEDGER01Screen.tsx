import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { finLedger01 } from '../spec/screens'
import {
  FINANCE_LEDGER_ASSET as ASSET,
  FINANCE_LEDGER_SCREEN as SCREEN,
} from './finance-ledger/config'
import { FinanceLedgerView } from './finance-ledger/FinanceLedgerView'
import { useFinanceLedger } from './finance-ledger/useFinanceLedger'

interface FINLEDGER01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function FINLEDGER01Screen({ screenParams, onNavigate }: FINLEDGER01ScreenProps) {
  const model = useFinanceLedger(screenParams)
  const breadcrumb = finLedger01.breadcrumb

  return (
    <AppShell
      screenId={finLedger01.screenId}
      activeNavigationScreenId={finLedger01.activeNavigationScreenId}
      eyebrow={finLedger01.meta?.eyebrow}
      title={finLedger01.meta?.title ?? finLedger01.screenId}
      description={finLedger01.meta?.description}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
    >
      <FinanceLedgerView model={model} />
    </AppShell>
  )
}
