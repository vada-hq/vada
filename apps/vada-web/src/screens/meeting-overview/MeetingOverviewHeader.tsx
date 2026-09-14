import { FigmaAsset } from '../../components/FigmaAsset'
import { CREATE_VARIANT } from './spec'
import type { MeetingOverviewModel } from './useMeetingOverview'

export function MeetingOverviewHeaderAction({ model }: { model: MeetingOverviewModel }) {
  const create = model.create
  if (create === null) return null

  return (
    <button
      type="button"
      data-node-id={CREATE_VARIANT.node}
      disabled={create.initiallyDisabled}
      onClick={() => {
        if (create.action.type === 'navigate') {
          model.onNavigate(create.action.targetScreenId)
        }
      }}
      className="flex items-center gap-1.5 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      <FigmaAsset
        screenId={CREATE_VARIANT.screen}
        nodeId={CREATE_VARIANT.asset}
        className="size-3.5"
      />
      {create.label}
    </button>
  )
}
