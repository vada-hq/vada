import { useState } from 'react'
import type { DataRow } from '../../data-sources/definitions'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import { scalar } from './spec'

interface MeetingSummaryActionOptions {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useMeetingSummaryActions({
  screenParams,
  onNavigate,
}: MeetingSummaryActionOptions) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  const download = (spec: ButtonSpec | undefined, row: DataRow) => () => {
    if (spec === undefined || spec.action.type !== 'download') return
    setNote(`${spec.label}: ${scalar(row, spec.action.downloadField)}`)
  }

  const acknowledge = (spec: ButtonSpec) => {
    void submitAction.run(spec.action as SubmitAction, {
      payload: { meetingId: screenParams.meetingId ?? '' },
      onNavigate,
    })
  }

  return { submitAction, note, setNote, download, acknowledge }
}

export type MeetingSummaryActions = ReturnType<typeof useMeetingSummaryActions>
