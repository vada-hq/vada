import { useState } from 'react'
import type { ApplicantChange } from '@vada/contracts'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import StateMessage from '@/components/StateMessage'
import { ApplicantList } from '@/registrations/ApplicantList'
import { staffForm } from './staff-registration-fixtures'

// 양식별 단건 동작은 목록 부품 자체에서 검사한다. 행사 탭의 통합 표는 별도 시험이 맡는다.
export function ApplicantListHarness(handlers: EventDialogHandlers) {
  const [changes, setChanges] = useState<ReadonlyMap<string, ApplicantChange>>(new Map())
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <>
      {notice && <StateMessage kind="error">{notice}</StateMessage>}
      <ApplicantList
        councilId="c1"
        formId={staffForm().id}
        changes={changes}
        onChange={change => setChanges(before => new Map(before).set(change.id, change))}
        onLoaded={ids =>
          setChanges(before => {
            const next = new Map(before)
            for (const id of ids) next.delete(id)
            return next
          })
        }
        onCancelled={() => undefined}
        onForbidden={handlers.onForbidden}
        onLost={message => {
          setNotice(message)
          handlers.onLost(message)
        }}
      />
    </>
  )
}
