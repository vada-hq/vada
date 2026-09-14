import { FigmaAsset } from '../../components/FigmaAsset'
import { ProgressBar } from '../../components/ProgressBar'
import type { DataRow } from '../../data-sources/definitions'
import { NEUTRAL_CHIP, STATUS_CHIP } from '../../design/tones'
import type { Option } from '../../option-sources/definitions'
import type { SelectSpec, SummarySpec } from '../../spec/types'
import { ASSET, NODE, SCREEN } from './spec'

interface EventTaskOverviewProps {
  eventSpec: SummarySpec
  event: DataRow
  alerts: SummarySpec
  alertRow: DataRow
  scope: SelectSpec
  scopeOptions: Option[]
  scopeValue: string
  onScopeChange: (value: string) => void
}

/** 행사 진행률, 주의 항목과 보드 범위 선택을 그린다. */
export function EventTaskOverview({
  eventSpec,
  event,
  alerts,
  alertRow,
  scope,
  scopeOptions,
  scopeValue,
  onScopeChange,
}: EventTaskOverviewProps) {
  return (
    <>
      <section
        data-node-id={NODE.event}
        className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4"
      >
        <span>
          <span className="block text-sm font-bold text-gray-900">
            {String(event[eventSpec.titleField ?? ''])}
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            {String(event[eventSpec.items?.[0]?.field ?? ''])}
          </span>
        </span>
        <span className="flex items-center gap-6">
          {(eventSpec.items ?? []).slice(1, 2).map((item) => (
            <span key={item.label} className="text-center">
              <span className="block text-xs text-gray-400">{item.label}</span>
              <span className="block text-xl font-bold text-blue-600">
                {String(event[item.field ?? ''])}
              </span>
            </span>
          ))}
          {(eventSpec.items ?? []).slice(2, 3).map((item) => (
            <span key={item.label} className="block border-l border-gray-100 pl-6">
              <span className="block pb-1 text-right text-xs text-gray-400">{item.label}</span>
              <ProgressBar
                percent={Number(event.progressPercent)}
                ariaLabel={item.label}
                label={<span className="font-bold text-gray-700">{String(event[item.field ?? ''])}</span>}
              />
            </span>
          ))}
        </span>
      </section>
      <div className="flex flex-wrap items-center gap-2 py-4">
        <div data-node-id={NODE.alerts} className="flex flex-1 flex-wrap gap-2">
          {(alerts.items ?? []).map((item) => (
            <span
              key={item.label}
              data-design-rule="status-chip"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                STATUS_CHIP[item.field ?? ''] ?? NEUTRAL_CHIP
              }`}
            >
              {item.field && ASSET.alertByField[item.field] ? (
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.alertByField[item.field]} className="size-3.5" />
              ) : null}
              {`${item.label} ${item.field ? alertRow[item.field] : (item.value ?? '')}${item.unit ?? ''}`}
            </span>
          ))}
        </div>
        <div
          data-node-id={NODE.scope}
          role="radiogroup"
          aria-label={scope.label ?? '보는 범위'}
          className="flex shrink-0 gap-1 rounded-lg bg-gray-100 p-0.5"
        >
          {scopeOptions.map((option) => {
            const value = String(option.value)
            const selected = value === scopeValue
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onScopeChange(value)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  selected ? 'bg-white' : 'hover:bg-gray-50'
                }`}
              >
                <span className={selected ? 'text-blue-700' : 'text-gray-500'}>{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
