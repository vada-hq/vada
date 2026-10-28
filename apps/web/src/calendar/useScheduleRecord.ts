import { useEffect, useState } from 'react'
import {
  KOREAN_DATE_LENGTH,
  menuPath,
  statusOf,
  type ScheduleItemDetail,
  type ScheduleItemResponse,
} from '@vada/contracts'
import { navigate, releaseRecord } from '@/lib/app-location'
import { useAddressRecord } from '@/lib/use-address-record'
import { usePolledRead } from '@/lib/use-polled-read'
import { postJson } from '@/lib/api'
import { SAVE_FAILED, SCHEDULE_NOT_FOUND } from '@/lib/messages'

function closeSchedule(councilId: string) {
  releaseRecord()
  if (window.location.pathname.startsWith(`/schedule/${councilId}/`))
    navigate(menuPath('calendar', councilId), { replace: true })
}

type Handlers = {
  close: () => void
  missing: () => void
  onForbidden: () => void
  reload: () => Promise<void>
}

async function cancelSchedule(path: string, handlers: Handlers) {
  const result = await postJson<{ ok: true }>(`${path}/delete`, {})
  if (result.ok) {
    handlers.close()
    return null
  }
  if (result.status === statusOf('NOT_FOUND')) {
    handlers.missing()
    return null
  }
  if (result.status === statusOf('FORBIDDEN')) {
    handlers.onForbidden()
    void handlers.reload()
  }
  return SAVE_FAILED
}

export function useScheduleRecord(
  councilId: string,
  selectDay: (date: string) => void,
  onForbidden: () => void,
) {
  const id = useAddressRecord('schedule', councilId)
  const [notice, setNotice] = useState<string | null>(null)
  const close = () => closeSchedule(councilId)
  const missing = () => {
    setNotice(SCHEDULE_NOT_FOUND)
    close()
  }
  const path = `/api/organizations/${councilId}/schedule/${id}`
  const read = usePolledRead<ScheduleItemResponse>(
    path,
    status => {
      if (status === statusOf('NOT_FOUND')) missing()
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    Boolean(id),
  )
  const item = id && read.state.kind === 'ready' ? read.state.data.item : null
  const startDay = item?.start.slice(0, KOREAN_DATE_LENGTH)
  useEffect(() => {
    if (startDay) selectDay(startDay)
  }, [id, startDay, selectDay])
  useEffect(() => {
    if (id) setNotice(null)
  }, [id])
  const handlers = { close, missing, onForbidden, reload: read.reload }
  return {
    id,
    item,
    notice,
    close,
    missing,
    cancel: () => cancelSchedule(path, handlers),
    state: read.state,
    retry: read.reload,
    replace: (next: ScheduleItemDetail) => read.replace({ item: next }),
  }
}
