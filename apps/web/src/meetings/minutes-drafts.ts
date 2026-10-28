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

// 저장하지 못한 글은 메모리에 남겨 같은 사람이 회의를 다시 열면 되살린다(새로 고침 전까지, DEC-78 이동 10).
// 대화 입력칸(chat/composer-drafts.ts)과 같이 기기 저장소에는 쓰지 않고, 열쇠에 내 멤버 id를 넣어 같은 브라우저의 다른 사람에게 보이지 않게 한다.
type Kept = { text: string; version: number }
const kept = new Map<string, Kept>()
// 사람·회의마다 가장 나중에 연 저장소. 앞 화면의 늦은 응답이 다시 연 화면의 남긴 글을 지우거나 덮지 않게 한다(mtg-4 검토).
const latest = new Map<string, object>()
const keyOf = (memberId: string, base: string, id: string) => `${memberId}|${base}|${id}`
// 결정·안건 폼에 쓰던 글도 같이 남긴다. 다시 읽기로 그 안건이 빠지면 폼이 사라지므로 옮겨 쓸 글로 보인다.
// baseVersionNo는 폼을 처음 연 때의 판이다. 되살린 글은 그 판으로 보내 그사이 바뀐 것을 충돌로 알린다.
type KeptEntry = {
  agendaId: string | null
  text: string
  main: string
  extra: string
  baseVersionNo?: number | undefined
}
const entries = new Map<string, KeptEntry>()
export type MinutesScope = { memberId: string; base: string }
export const keptEntry = (scope: MinutesScope, formKey: string) =>
  entries.get(keyOf(scope.memberId, scope.base, formKey))
export function keepEntry(scope: MinutesScope, formKey: string, value: KeptEntry | null) {
  const key = keyOf(scope.memberId, scope.base, formKey)
  if (value) entries.set(key, value)
  else entries.delete(key)
}
export const lostEntries = (scope: MinutesScope, agendaIds: readonly string[]) =>
  [...entries]
    .filter(
      ([key, value]) =>
        key.startsWith(keyOf(scope.memberId, scope.base, '')) &&
        value.agendaId !== null &&
        !agendaIds.includes(value.agendaId),
    )
    .map(([, value]) => value.text)
// 시험용: 앞 시험이 남긴 글을 비운다.
export function resetKeptMinutes() {
  kept.clear()
  latest.clear()
  entries.clear()
}

// 저장소 하나는 화면 하나(한 사람·한 회의)의 것이다. 화면을 떠난 뒤에는 새 요청을 보내지 않는다:
// 늦은 응답 뒤 이어 보내기가 다른 계정의 세션으로 나갈 수 있다(mtg-4 검토). 남은 글은 위 메모리가 지킨다.
export const minutesDrafts = (base: string, meeting: MeetingDetail, memberId: string) =>
  new MinutesDrafts(base, meeting, memberId)

class MinutesDrafts {
  private drafts: ReadonlyMap<string, MinutesDraft>
  private listeners = new Set<() => void>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private flights = new Map<string, Promise<void>>()
  private onSaved: ((meeting: MeetingDetail) => void) | null = null
  private closed = false
  private lost: string[]
  constructor(
    private base: string,
    meeting: MeetingDetail,
    private memberId: string,
  ) {
    const prefix = keyOf(memberId, base, '')
    latest.set(prefix, this)
    this.drafts = new Map(meeting.agenda.map(item => [item.id, this.restored(item)]))
    const ids = new Set(meeting.agenda.map(item => item.id))
    this.lost = [...kept]
      .filter(([key]) => key.startsWith(prefix) && !ids.has(key.slice(prefix.length)))
      .map(([, value]) => value.text)
  }
  private restored(item: MeetingAgendaItem): MinutesDraft {
    const draft = draftOf(item)
    const left = kept.get(keyOf(this.memberId, this.base, item.id))
    return left ? { ...draft, text: left.text, version: left.version } : draft
  }
  // 빠진 안건에 남은 글: 저장할 곳이 없으므로 옮겨 쓸 수 있게 보인다.
  lostTexts = () => this.lost
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.drafts
  private keep(id: string, value: MinutesDraft) {
    // 더 나중에 연 화면이 있으면 남길 글은 그 화면의 것이다.
    if (latest.get(keyOf(this.memberId, this.base, '')) !== this) return
    const key = keyOf(this.memberId, this.base, id)
    if (isMinutesDirty(value)) kept.set(key, { text: value.text, version: value.version })
    else kept.delete(key)
  }
  private put(id: string, value: MinutesDraft) {
    this.keep(id, value)
    this.drafts = new Map(this.drafts).set(id, value)
    for (const listener of this.listeners) listener()
  }
  attach(onSaved: (meeting: MeetingDetail) => void) {
    this.onSaved = onSaved
    this.closed = false
    // 되살린 글은 다시 연 뒤 한 번 저장해 본다(판이 바뀌었으면 충돌로 보인다).
    for (const [id, draft] of this.drafts)
      if (isMinutesDirty(draft) && !this.timers.has(id) && !this.flights.has(id))
        this.change(id, draft.text)
  }
  // 떠나는 순간의 글은 지금 세션으로 한 번 보내고, 그 뒤로는 아무것도 보내지 않는다.
  detach() {
    this.onSaved = null
    this.flush()
    this.closed = true
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
    if (this.closed) return Promise.resolve()
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
      if (result.code === 'VERSION_CONFLICT' && !this.closed) await this.refreshConflict(id)
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
    if (latest.get(keyOf(this.memberId, this.base, '')) === this)
      kept.delete(keyOf(this.memberId, this.base, id))
    const rest = new Map(this.drafts)
    rest.delete(id)
    this.drafts = rest
    for (const listener of this.listeners) listener()
  }
  keepalive() {
    if (this.closed) return
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
