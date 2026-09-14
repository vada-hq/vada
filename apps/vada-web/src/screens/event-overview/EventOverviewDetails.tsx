import type { ReactNode } from 'react'
import type { SummarySpec } from '../../spec/types'
import { NODE } from './spec'
import type { EventOverviewModel } from './useEventOverview'

function LabelledCard({
  nodeId,
  spec,
  row,
  action,
}: {
  nodeId: string
  spec: SummarySpec
  row: Record<string, unknown>
  action?: ReactNode
}) {
  return (
    <section data-node-id={nodeId} className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
        <span>{spec.title}</span>
        {action}
      </h2>
      <dl className="pt-2">
        {(spec.items ?? []).map((item) => (
          <span key={item.label} className="flex gap-3 py-1.5">
            <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
            <dd className="text-xs text-gray-700">{String(row[item.field ?? ''])}</dd>
          </span>
        ))}
      </dl>
    </section>
  )
}

export function EventOverviewDetails({ model }: { model: EventOverviewModel }) {
  return (
    <div className="flex flex-col gap-3">
      <LabelledCard nodeId={NODE.basics} spec={model.basics.spec} row={model.basics.row} />
      <LabelledCard
        nodeId={NODE.recruit}
        spec={model.recruit.spec}
        row={model.recruit.row}
        action={
          <button
            type="button"
            data-node-id={NODE.recruitEdit}
            onClick={model.pressRecruitEdit}
            className="text-xs font-medium text-blue-500 hover:text-blue-700"
          >
            {model.recruitEdit.label}
          </button>
        }
      />
    </div>
  )
}
