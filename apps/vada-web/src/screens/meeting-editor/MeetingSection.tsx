import type { ReactNode } from 'react'
import type { GroupSpec } from '../../spec/types'
import { specOf } from './meeting-spec'

export function MeetingSectionHeading({ nodeId, step }: { nodeId: string; step: number }) {
  const group = specOf(nodeId) as GroupSpec
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-600">
        {step}
      </span>
      <span>
        <span className="block text-sm font-bold text-gray-900">{group.title}</span>
        <span className="block pt-0.5 text-xs text-gray-400">{group.description}</span>
      </span>
    </div>
  )
}

export function MeetingSection({
  nodeId,
  step,
  children,
}: { nodeId: string; step: number; children: ReactNode }) {
  const group = specOf(nodeId) as GroupSpec
  return (
    <section
      data-node-id={nodeId}
      aria-label={group.title}
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <MeetingSectionHeading nodeId={nodeId} step={step} />
      <div className="pt-5">{children}</div>
    </section>
  )
}
