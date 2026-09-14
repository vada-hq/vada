import { FigmaAsset } from '../../components/FigmaAsset'
import type { SubmitAction } from '../../spec/types'
import type { MeetingSummaryView } from './data'
import { ABSENTEE, ASSET, NODE, SCREEN } from './spec'
import type { MeetingSummaryActions } from './useMeetingSummaryActions'

export function MeetingSummaryHeaderAction({
  view,
  actions,
}: {
  view: MeetingSummaryView
  actions: MeetingSummaryActions
}) {
  if (view.variant === null) {
    return (
      <button
        type="button"
        data-node-id={NODE.export}
        onClick={actions.download(view.specs.exportButton, view.detail)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.export} className="size-3.5" />
        {view.specs.exportButton.label}
      </button>
    )
  }

  const acknowledge = view.variant.acknowledge
  return (
    <button
      type="button"
      data-node-id={ABSENTEE.acknowledge.node}
      disabled={acknowledge.initiallyDisabled}
      onClick={() => actions.acknowledge(acknowledge)}
      className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
    >
      <FigmaAsset
        screenId={ABSENTEE.screen}
        nodeId={ABSENTEE.acknowledge.asset}
        className="size-3.5"
      />
      {actions.submitAction.labelOf(acknowledge.action as SubmitAction, acknowledge.label)}
    </button>
  )
}

export function MeetingSummaryNotices({ actions }: { actions: MeetingSummaryActions }) {
  return (
    <>
      {actions.submitAction.pendingNote === null ? null : (
        <p
          role="status"
          className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
        >
          {actions.submitAction.pendingNote}
        </p>
      )}
      {actions.submitAction.errorMessage === null ? null : (
        <p role="alert" className="text-xs font-medium text-red-500">
          {actions.submitAction.errorMessage}
        </p>
      )}
      {actions.note === null ? null : (
        <p
          role="status"
          className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
        >
          {actions.note}
        </p>
      )}
    </>
  )
}
