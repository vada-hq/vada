import type { StepsSpec } from '../../spec/types'

export function UploadSteps({
  nodeId,
  spec,
  current,
}: {
  nodeId: string
  spec: StepsSpec
  current: string
}) {
  return (
    <ol data-node-id={nodeId} className="flex items-center gap-4 border-b border-gray-100 px-6 py-4">
      {spec.items.map((item, index) => {
        const active = item.key === current
        return (
          <li key={item.key} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
              <span>{index + 1}</span>
              <span aria-current={active ? 'step' : undefined}>{item.label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
