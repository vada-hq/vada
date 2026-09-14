import { useState } from 'react'
import { resolveParams } from '../../spec/params'
import type { ButtonSpec } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'

interface MeetingLiveActionOptions {
  host: boolean
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

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
    } else if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  const runHostAction = (spec: ButtonSpec) => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
    } else if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    } else if (spec.action.type === 'submit') {
      void submitAction.run(spec.action, {
        payload: { meetingId: screenParams.meetingId ?? '' },
        onNavigate,
      })
    }
  }

  return { host, note, setNote, submitAction, press, runHostAction }
}

export type MeetingLiveActions = ReturnType<typeof useMeetingLiveActions>
