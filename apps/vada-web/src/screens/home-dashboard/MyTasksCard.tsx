import { readObjectSource } from '../../data-sources/catalog'
import type { SummarySpec } from '../../spec/types'
import { NODE, specOf } from './spec'

export function MyTasksCard({ onNavigate }: { onNavigate: (screenId: string) => void }) {
  const spec = specOf<SummarySpec>(NODE.myTasksButton)
  const action = spec.action!
  const goesTo =
    action.type === 'navigate' && 'targetScreenId' in action ? action.targetScreenId : null
  const note = readObjectSource(spec.dataSourceKey!)[spec.items![0]!.field!]

  return (
    <button
      type="button"
      data-node-id={NODE.myTasksButton}
      onClick={goesTo === null ? undefined : () => onNavigate(goesTo)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-400">{spec.title}</span>
        <span className="block pt-0.5 text-xs font-bold text-gray-700">{String(note)}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-gray-400">{action.label}</span>
    </button>
  )
}
