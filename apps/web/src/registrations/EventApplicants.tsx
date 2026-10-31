import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  BulkApplicantsSchema,
  type ApplicantChange,
  type BulkApplicantsResponse,
  type EventApplicant,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import {
  APPLICANTS_LOAD_FAILED,
  EVENT_APPLICANTS,
  REGISTRATION_STAFF_ERRORS,
} from '@/lib/registration-messages'
import { visibleOf, type ApplicantFilter } from './applicant-summary'
import type { BulkKind } from './EventApplicantsBulk'
import { EventApplicantsView } from './EventApplicantsView'
import { eventApplicantsPath, useEventApplicants } from './useEventApplicants'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 행사 시작 시각(한국). 첫날부터 [불참 처리]를 보인다.
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
        absent: change.absent,
        cancelled: change.cancelled,
        deposit: change.deposit,
        actions: change.actions,
      },
    ]
  })
}

type List = ReturnType<typeof useEventApplicants>

// 고른 줄은 지금 보이는 줄 안에만 남긴다. 취소나 다시 읽기로 빠진 줄이 수에 남아 일괄 처리에 실리면 안 된다.
function useKeepSelectionShown(
  list: List,
  view: { filter: ApplicantFilter; page: number; changes: Props['changes'] },
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>,
) {
  const { filter, page, changes } = view
  useEffect(() => {
    if (list.state.kind !== 'ready') return
    const { applicants, canManage } = list.state.data
    const { rows } = visibleOf(updatedRows(applicants, changes), filter, page)
    setSelected(before => {
      const kept = [...before].filter(id => canManage && rows.some(row => row.id === id))
      return kept.length === before.size ? before : new Set(kept)
    })
  }, [list.state, changes, filter, page, setSelected])
}

function useEventControls(props: Props, list: List) {
  const post = useStaffPost(props)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<BulkApplicantsResponse | null>(null)
  const [resultKind, setResultKind] = useState<BulkKind>('deposit')
  const [resultNames, setResultNames] = useState<ReadonlyMap<string, string>>(new Map())
  const [problem, setProblem] = useState<string | null>(null)
  // 거르기와 쪽은 화면 상태다. 바꿔도 서버를 다시 부르지 않는다(DEC-93).
  const [filter, setFilter] = useState<ApplicantFilter>({})
  const [page, setPage] = useState(1)
  const loaded = useRef(props.onLoaded)
  useEffect(() => {
    loaded.current = props.onLoaded
  })
  useEffect(() => {
    if (list.state.kind !== 'ready') return
    const data = list.state.data
    loaded.current?.(data.applicants.map(row => row.id))
    if (!data.canManage) {
      setResult(null)
      setResultNames(new Map())
    }
  }, [list.state])
  useKeepSelectionShown(list, { filter, page, changes: props.changes }, setSelected)
  const setQuery = (query: ApplicantFilter) => {
    if (post.busy) return
    setSelected(new Set())
    setResult(null)
    setResultNames(new Map())
    setFilter(before => ({ ...before, ...query }))
    setPage(1)
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
    filter,
    page,
    // 쪽을 넘기면 고른 줄을 푼다(일괄 처리는 보이는 쪽 안에서, 50명까지).
    setPage: (next: number) => {
      setSelected(new Set())
      setPage(next)
    },
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
  // 고르기는 지금 쪽의 줄만 한 번에 고른다(일괄 처리 한 번은 50명까지).
  const pageRows = visibleOf(data.applicants, controls.filter, controls.page).rows
  const togglePage = () =>
    setSelected(before =>
      pageRows.every(row => before.has(row.id)) ? new Set() : new Set(pageRows.map(row => row.id)),
    )
  return (
    <>
      <EventApplicantsView
        councilId={props.councilId}
        data={data}
        startsAt={props.startsAt ?? null}
        query={controls.filter}
        page={controls.page}
        selected={selected}
        result={result}
        resultKind={controls.resultKind}
        resultNames={resultNames}
        busy={post.busy || list.busy}
        submitting={post.busy}
        onQuery={setQuery}
        onPage={controls.setPage}
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
