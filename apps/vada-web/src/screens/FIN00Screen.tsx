import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FinanceActivity } from './finance-overview/FinanceActivity'
import { FinanceBreakdown } from './finance-overview/FinanceBreakdown'
import { FinanceSummary } from './finance-overview/FinanceSummary'
import { ASSET, NODE, SCREEN } from './finance-overview/spec'
import { useFinanceOverview } from './finance-overview/useFinanceOverview'

interface FIN00ScreenProps {
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 전체 재정 데이터를 요약, 구분별 현황과 최근 활동에 연결한다. */
export function FIN00Screen({ screenId = SCREEN, onNavigate }: FIN00ScreenProps) {
  const model = useFinanceOverview({ screenId, onNavigate })
  return (
    <AppShell
      screenId={model.screen.screenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        model.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={model.breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <span data-node-id={NODE.period} className="flex items-center gap-4">
          {(model.period.items ?? []).map((item, index) => (
            <span key={item.field} className={`block ${index === 0 ? '' : 'border-l border-gray-200 pl-4'}`}>
              <span className="block text-right text-xs text-gray-400">{item.label}</span>
              <span className="block pt-0.5 text-right text-xs font-semibold text-gray-700">
                {String(model.overview[item.field ?? ''])}
              </span>
            </span>
          ))}
        </span>
      }
    >
      <div data-node-id={NODE.intro}>
        <h2 className="text-lg font-semibold text-gray-900">{model.intro.title}</h2>
        <p className="pt-1 text-sm text-gray-500">{model.intro.description}</p>
      </div>
      <FinanceSummary model={model} />
      <FinanceBreakdown model={model} />
      <FinanceActivity model={model} />
      {model.note === null ? null : (
        <p role="status" className="pt-4 text-xs text-gray-500">{model.note}</p>
      )}
    </AppShell>
  )
}
