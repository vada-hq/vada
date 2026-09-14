import { FigmaAsset } from '../../components/FigmaAsset'
import type { SubmitAction } from '../../spec/types'
import { HOST, hostButtonAt } from './spec'
import type { HostActionSlot } from './spec'
import type { MeetingLiveActions } from './useMeetingLiveActions'

interface HostActionButtonProps {
  slot: HostActionSlot
  className: string
  actions: MeetingLiveActions
}

export function HostActionButton({ slot, className, actions }: HostActionButtonProps) {
  if (!actions.host) return null
  const spec = hostButtonAt(slot.node)

  return (
    <button
      type="button"
      data-node-id={slot.node}
      disabled={spec.initiallyDisabled}
      onClick={() => actions.runHostAction(spec)}
      className={className}
    >
      {slot.asset === null ? null : (
        <FigmaAsset screenId={HOST.screen} nodeId={slot.asset} className="size-3.5" />
      )}
      {spec.action.type === 'submit'
        ? actions.submitAction.labelOf(spec.action as SubmitAction, spec.label)
        : spec.label}
    </button>
  )
}

export function MeetingLiveNotices({ actions }: { actions: MeetingLiveActions }) {
  return (
    <>
      {actions.submitAction.errorMessage === null ? null : (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
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
