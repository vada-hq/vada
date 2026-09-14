import { AppShell } from '../components/AppShell'
import { EventFinanceColumns } from './event-finance/EventFinanceColumns'
import {
  EventFinanceHeaderActions,
  EventFinanceWorkspaceHeader,
} from './event-finance/EventFinanceHeader'
import { EventFinanceTabs } from './event-finance/EventFinanceTabs'
import { EventFinanceTotals } from './event-finance/EventFinanceTotals'
import {
  useEventFinance,
  type EventFinanceProps,
} from './event-finance/useEventFinance'

// 행사 재정(EVT-FIN-01). 금액 요약, 단계 탭, 요청 열을 조립한다.
export function EVTFIN01Screen(props: EventFinanceProps) {
  const model = useEventFinance(props)
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
      title={model.title}
      onNavigate={model.onNavigate}
      headerAction={<EventFinanceHeaderActions model={model} />}
    >
      <EventFinanceWorkspaceHeader model={model} />
      <EventFinanceTotals model={model} />
      <EventFinanceTabs model={model} />
      {model.note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {model.note}
        </p>
      )}
      <EventFinanceColumns model={model} />
    </AppShell>
  )
}
