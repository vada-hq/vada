import { useEffect, useState, useSyncExternalStore } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { useUnsavedInput } from '@/lib/leave-guard'
import { isMinutesDirty, minutesDrafts } from './minutes-drafts'

export function useMinutesAutosave(
  base: string,
  meeting: MeetingDetail,
  onSaved: (meeting: MeetingDetail) => void,
) {
  const [store] = useState(() => minutesDrafts(base, meeting))
  const drafts = useSyncExternalStore(store.subscribe, store.snapshot)
  useEffect(() => {
    store.sync(meeting)
  }, [store, meeting])
  useEffect(() => {
    store.attach(onSaved)
  }, [store, onSaved])
  useEffect(() => () => store.detach(), [store])
  useEffect(() => {
    const hide = () => store.keepalive()
    const warn = (event: BeforeUnloadEvent) => {
      if (!store.hasUnsaved()) return
      store.flush()
      event.preventDefault()
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('beforeunload', warn)
    }
  }, [store])
  // 충돌·실패 중 떠나는 것은 사람이 확인한다. 일반 입력은 이동 때 즉시 저장한다.
  useUnsavedInput(
    [...drafts.values()].some(
      d => isMinutesDirty(d) && Boolean(d.error || d.conflict || d.refreshing),
    ),
  )
  return { drafts, store }
}
