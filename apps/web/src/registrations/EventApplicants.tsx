import { useEffect, useRef, useState } from 'react'
import {
  BulkApplicantsSchema,
  type ApplicantChange,
  type BulkApplicantsResponse,
  type EventApplicant,
  type EventApplicantsQuery,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import {
  APPLICANTS_LOAD_FAILED,
  EVENT_APPLICANTS,
  REGISTRATION_STAFF_ERRORS,
} from '@/lib/registration-messages'
import type { BulkKind } from './EventApplicantsBulk'
import { EventApplicantsView } from './EventApplicantsView'
import { eventApplicantsPath, useEventApplicants } from './useEventApplicants'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 행사 시작 시각(한국). 첫날부터 출석 기록 없음을 '불참'이라 한다.
  startsAt?: string | null
  changes?: ReadonlyMap<string, ApplicantChange>
  onChange?: (change: ApplicantChange) => void
  onLoaded?: (ids: string[]) => void
}

function updatedRows(rows: EventApplicant[], changes: Props['changes']) {
  return rows.flatMap(row => {
    const change = changes?.get(row.id)
    if (!change) return [row]
    if (!change.listed) return []
    return [
      {
        ...row,
        attended: change.attended,
        cancelled: change.cancelled,
        deposit: change.deposit,
        actions: change.actions,
      },
    ]
  })
}

type List = ReturnType<typeof useEventApplicants>

function useEventControls(props: Props, list: List) {
  const post = useStaffPost(props)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<BulkApplicantsResponse | null>(null)
  const [resultKind, setResultKind] = useState<BulkKind>('deposit')
  const [resultNames, setResultNames] = useState<ReadonlyMap<string, string>>(new Map())
  const [problem, setProblem] = useState<string | null>(null)
  const loaded = useRef(props.onLoaded)
  useEffect(() => {
    loaded.current = props.onLoaded
  })
  useEffect(() => {
    if (list.state.kind !== 'ready') return
    const data = list.state.data
    loaded.current?.(data.applicants.map(row => row.id))
    setSelected(
      before =>
        new Set(
          [...before].filter(id => data.canManage && data.applicants.some(row => row.id === id)),
        ),
    )
    if (!data.canManage) {
      setResult(null)
      setResultNames(new Map())
    }
  }, [list.state])
  const setQuery = (query: Partial<EventApplicantsQuery>) => {
    if (post.busy) return
    setSelected(new Set())
    setResult(null)
    setResultNames(new Map())
    list.setQuery(before => ({ ...before, ...query, page: query.page ?? 1 }))
  }
  const toggle = (id: string) =>
    setSelected(before => {
      const next = new Set(before)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  async function bulk(kind: BulkKind) {
    const parsed = BulkApplicantsSchema.safeParse({ registrationIds: [...selected] })
    if (!parsed.success) return setProblem(REGISTRATION_STAFF_ERRORS.INVALID_INPUT!)
    const names = new Map(
      list.state.kind === 'ready'
        ? list.state.data.applicants
            .filter(row => selected.has(row.id))
            .map(row => [row.id, row.name])
        : [],
    )
    const response = await post.send<BulkApplicantsResponse>(
      `${eventApplicantsPath(props.councilId, props.eventId)}/${kind}`,
      parsed.data,
    )
    if (!response.ok) {
      await list.reload()
      return
    }
    setProblem(null)
    setResult(response.data)
    setResultKind(kind)
    setResultNames(names)
    setSelected(
      new Set(
        response.data.results.filter(row => row.error !== null).map(row => row.registrationId),
      ),
    )
    await list.reload()
  }
  return {
    post,
    selected,
    result,
    resultKind,
    resultNames,
    problem,
    setQuery,
    toggle,
    bulk,
    setSelected,
  }
}

export function EventApplicants(props: Props) {
  const list = useEventApplicants(props.councilId, props.eventId, props)
  const controls = useEventControls(props, list)
  const { post, selected, result, resultNames, problem, setQuery, toggle, bulk, setSelected } =
    controls
  if (list.state.kind === 'loading')
    return <StateMessage kind="loading">{EVENT_APPLICANTS.loading}</StateMessage>
  if (list.state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-2">
        <StateMessage kind="error">{APPLICANTS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" touch onClick={() => void list.reload()}>
          {EVENT_APPLICANTS.retry}
        </Button>
      </div>
    )
  const data = {
    ...list.state.data,
    applicants: updatedRows(list.state.data.applicants, props.changes),
  }
  const togglePage = () =>
    setSelected(before =>
      data.applicants.every(row => before.has(row.id))
        ? new Set()
        : new Set(data.applicants.map(row => row.id)),
    )
  return (
    <>
      <EventApplicantsView
        councilId={props.councilId}
        data={data}
        startsAt={props.startsAt ?? null}
        query={list.query}
        selected={selected}
        result={result}
        resultKind={controls.resultKind}
        resultNames={resultNames}
        busy={post.busy || list.busy}
        submitting={post.busy}
        onQuery={setQuery}
        onPage={page => setQuery({ page })}
        onToggle={toggle}
        onTogglePage={togglePage}
        onUnselect={() => setSelected(new Set())}
        onBulk={kind => void bulk(kind)}
        onReload={() => void list.reload()}
        onChange={change => {
          props.onChange?.(change)
          void list.reload()
        }}
        onForbidden={() => {
          props.onForbidden()
          void list.reload()
        }}
        onLost={props.onLost}
      />
      {(problem ?? post.problem) && (
        <StateMessage kind="error">{problem ?? post.problem}</StateMessage>
      )}
    </>
  )
}
