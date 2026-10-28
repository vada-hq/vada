import {
  UpdateAgendaSchema,
  type MeetingAgendaItem,
  type MeetingDetail,
  type MeetingResponse,
} from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { meetingError } from './meeting-text'

const MINUTES_SAVE_DELAY_MS = 1500
export type MinutesDraft = {
  text: string
  savedText: string
  version: number
  server: MeetingAgendaItem
  saving: boolean
  error: string | null
  conflict: MeetingAgendaItem | null
  refreshing: boolean
}
const draftOf = (server: MeetingAgendaItem): MinutesDraft => ({
  text: server.notes ?? '',
  savedText: server.notes ?? '',
  version: server.versionNo,
  server,
  saving: false,
  error: null,
  conflict: null,
  refreshing: false,
})
export const isMinutesDirty = (draft: MinutesDraft) => draft.text !== draft.savedText

// 저장소는 화면 하나(한 사람·한 회의)에만 산다. 모듈에 두면 같은 탭에서 계정을 바꾼 사람에게 앞사람의 초안이 보이고
// 그 세션으로 보내졌다(mtg-4 검토). 실패·충돌한 초안은 떠날 때 확인(useUnsavedInput)이 지킨다.
export const minutesDrafts = (base: string, meeting: MeetingDetail) =>
  new MinutesDrafts(base, meeting)

class MinutesDrafts {
  private drafts: ReadonlyMap<string, MinutesDraft>
  private listeners = new Set<() => void>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private flights = new Map<string, Promise<void>>()
  private onSaved: ((meeting: MeetingDetail) => void) | null = null
  constructor(
    private base: string,
    meeting: MeetingDetail,
  ) {
    this.drafts = new Map(meeting.agenda.map(item => [item.id, draftOf(item)]))
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.drafts
  private put(id: string, value: MinutesDraft) {
    this.drafts = new Map(this.drafts).set(id, value)
    for (const listener of this.listeners) listener()
  }
  attach(onSaved: (meeting: MeetingDetail) => void) {
    this.onSaved = onSaved
  }
  detach() {
    this.onSaved = null
    this.flush()
  }
  sync(meeting: MeetingDetail) {
    for (const item of meeting.agenda) {
      const before = this.drafts.get(item.id)
      if (
        before &&
        (isMinutesDirty(before) || before.saving || before.conflict || before.refreshing)
      )
        continue
      if (!before || (item.versionNo >= before.version && item !== before.server))
        this.put(item.id, draftOf(item))
    }
  }
  change(id: string, text: string) {
    const before = this.drafts.get(id)
    if (!before) return
    this.put(id, { ...before, text, error: before.refreshing ? before.error : null })
    this.clearTimer(id)
    if (!before.conflict && !before.refreshing)
      this.timers.set(
        id,
        setTimeout(() => {
          void this.save(id)
        }, MINUTES_SAVE_DELAY_MS),
      )
  }
  private clearTimer(id: string) {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
  }
  flush(id?: string) {
    const ids = id ? [id] : [...this.drafts.keys()]
    for (const key of ids) {
      this.clearTimer(key)
      void this.save(key)
    }
  }
  save(id: string): Promise<void> {
    this.clearTimer(id)
    const flight = this.flights.get(id)
    if (flight) return flight
    const draft = this.drafts.get(id)
    if (!draft || draft.conflict) return Promise.resolve()
    if (draft.refreshing) {
      const refreshing = this.refreshConflict(id).finally(() => this.flights.delete(id))
      this.flights.set(id, refreshing)
      return refreshing
    }
    if (!isMinutesDirty(draft)) return Promise.resolve()
    const parsed = UpdateAgendaSchema.safeParse({ notes: draft.text, baseVersionNo: draft.version })
    if (!parsed.success) {
      this.put(id, { ...draft, error: meetingError('INVALID_INPUT') })
      return Promise.resolve()
    }
    this.put(id, { ...draft, saving: true, error: null })
    const saving = this.send(id, draft).finally(() => {
      this.flights.delete(id)
      const next = this.drafts.get(id)
      if (next && isMinutesDirty(next) && !next.error && !next.conflict && !next.refreshing)
        void this.save(id)
    })
    this.flights.set(id, saving)
    return saving
  }
  private async send(id: string, sent: MinutesDraft) {
    const result = await postJson<MeetingResponse>(`${this.base}/agenda/${id}`, {
      notes: sent.text,
      baseVersionNo: sent.version,
    })
    const latest = this.drafts.get(id)
    if (!latest) return
    if (!result.ok) {
      this.put(id, {
        ...latest,
        saving: false,
        error: meetingError(result.code),
        refreshing: result.code === 'VERSION_CONFLICT',
      })
      if (result.code === 'VERSION_CONFLICT') await this.refreshConflict(id)
      return
    }
    const server = result.data.meeting.agenda.find(a => a.id === id)
    if (!server) {
      this.put(id, { ...latest, saving: false, error: meetingError('NOT_FOUND') })
      return
    }
    this.put(id, {
      ...latest,
      server,
      savedText: sent.text,
      version: server.versionNo,
      saving: false,
      error: null,
    })
    this.onSaved?.(result.data.meeting)
  }
  private async refreshConflict(id: string) {
    const result = await getJson<MeetingResponse>(this.base)
    const latest = this.drafts.get(id)
    if (!latest) return
    const server = result.ok ? result.data.meeting.agenda.find(a => a.id === id) : undefined
    if (!server) {
      this.put(id, {
        ...latest,
        error: meetingError(result.ok ? 'NOT_FOUND' : result.code),
        refreshing: true,
      })
      return
    }
    this.put(id, { ...latest, conflict: server, refreshing: false, error: null })
    if (result.ok) this.onSaved?.(result.data.meeting)
  }
  overwrite(id: string) {
    const draft = this.drafts.get(id)
    if (!draft?.conflict) return
    const fresh = draftOf(draft.conflict)
    this.put(id, { ...fresh, text: draft.text })
    void this.save(id)
  }
  adopt(id: string) {
    const draft = this.drafts.get(id)
    if (draft?.conflict) this.put(id, draftOf(draft.conflict))
  }
  forget(id: string) {
    this.clearTimer(id)
    const kept = new Map(this.drafts)
    kept.delete(id)
    this.drafts = kept
    for (const listener of this.listeners) listener()
  }
  keepalive() {
    for (const [id, draft] of this.drafts) {
      this.clearTimer(id)
      if (!isMinutesDirty(draft) || draft.conflict || draft.refreshing) continue
      const body = { notes: draft.text, baseVersionNo: draft.version }
      if (!UpdateAgendaSchema.safeParse(body).success) continue
      // 닫히는 문서에서도 브라우저가 요청을 이어 보내게 한다. 응답을 모르면 초안은 지우지 않는다.
      void fetch(`${this.base}/agenda/${id}`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {})
    }
  }
  hasUnsaved() {
    return [...this.drafts.values()].some(isMinutesDirty)
  }
}
