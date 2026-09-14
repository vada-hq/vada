import { useState } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { resolveParams } from '../../spec/params'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import { HOST, hostButtonAt } from './spec'
import type { HostActionSlot } from './spec'

interface MeetingLiveActionOptions {
  host: boolean
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 권한별 버튼의 이동·제출·미구현 안내 상태를 한곳에서 관리한다. */
export function useMeetingLiveActions({
  host,
  screenParams,
  onNavigate,
}: MeetingLiveActionOptions) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  const runHostAction = (spec: ButtonSpec) => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
      return
    }
    if (spec.action.type === 'submit') {
      void submitAction.run(spec.action, {
        payload: { meetingId: screenParams.meetingId ?? '' },
        onNavigate,
      })
    }
  }

  return { host, note, setNote, submitAction, press, runHostAction }
}

export type MeetingLiveActions = ReturnType<typeof useMeetingLiveActions>

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
