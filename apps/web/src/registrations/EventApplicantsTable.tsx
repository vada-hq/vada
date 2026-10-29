import type { ReactNode } from 'react'
import type { EventApplicant, EventApplicantsResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EVENT_APPLICANTS, eventApplicantSelect } from '@/lib/registration-messages'
import {
  AttendanceMark,
  AttentionMark,
  DepositMark,
  RegistrationMark,
  ResultMark,
} from './ApplicantMarks'
import { col, listSize, listType } from './list-look'

// ② 1280 명단: 문서 속 얇은 표. 바깥 상자 없이 종이 안에 열 이름 줄(회색 12px, 아래 선 하나, 스크롤하면 위에 붙음)과
// 40px 줄(줄 사이 가는 선, 줄무늬 없음, 올리면 연회색 면). 열 차례는 체크 → 이름 → 학번 → (소속) → (양식) → 신청 → 입금 → 참석 → ⋯.

// 한 줄을 그릴 때 쓰는 값(표·줄 목록 같이)
export type RowModel = {
  row: EventApplicant
  reason: string | null
  picked: boolean
  // 일괄 처리 뒤 이 줄의 결과(처리 = null, 실패 = 까닭). 이 줄을 보내지 않았으면 없다.
  result: { kind: 'deposit' | 'attendance'; failure: string | null } | undefined
  actions: ReactNode
}

export type ListProps = {
  data: EventApplicantsResponse
  rows: RowModel[]
  started: boolean
  busy: boolean
  onToggle: (id: string) => void
  onTogglePage: () => void
  onOpen: (id: string) => void
}

const th = `${listSize.headRow} px-2 text-left ${listType.label} whitespace-nowrap text-fg-muted`
// 체크 칸은 종이 왼쪽 여백 안에 둔다. 그래서 이름 열이 머리 '행사 참가자'와 같은 세로선에 선다.
const edgeL = 'pl-4 sm:pl-8'
const edgeR = 'pr-2 sm:pr-6'

export function CheckBox({
  label,
  checked,
  mixed = false,
  busy,
  onChange,
}: {
  label: string
  checked: boolean
  mixed?: boolean
  busy: boolean
  onChange: () => void
}) {
  return (
    <label className={`inline-flex ${listSize.hit} cursor-pointer items-center justify-center`}>
      <input
        type="checkbox"
        className="size-4 cursor-pointer accent-primary-emphasis"
        aria-label={label}
        checked={checked}
        ref={element => {
          if (element) element.indeterminate = mixed && !checked
        }}
        disabled={busy}
        onChange={onChange}
      />
    </label>
  )
}

// 이름(누르면 한 사람 보기) + 확인 필요면 ⚠ 까닭 글을 같은 줄에.
function NameButton({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      touch={false}
      onClick={onOpen}
      className={`h-auto min-h-0 shrink justify-start rounded-sm border-0 p-0 text-left ${listType.body} font-medium whitespace-normal text-fg wrap-anywhere hover:bg-transparent hover:text-fg hover:underline`}
    >
      {name}
    </Button>
  )
}

// 고른 줄은 파란 면(그 위 회색 글은 대비 4.5:1을 넘게 한 단 진하게), 확인 필요 줄은 노란 면, 나머지는 올리면 연회색.
export function rowSurface(model: RowModel, rest = '') {
  if (model.picked) return 'bg-primary-surface [&_.text-fg-muted]:text-fg-tertiary'
  return model.row.needsAttention ? 'bg-attention-surface' : rest
}

// 줄을 보냈으면 그 칸 아래에 결과를 남긴다.
function ResultFor({ model, kind }: { model: RowModel; kind: 'deposit' | 'attendance' }) {
  return model.result?.kind === kind ? <ResultMark failure={model.result.failure} /> : null
}

function StatusCells({ model, started }: { model: RowModel; started: boolean }) {
  const { row } = model
  return (
    <>
      <td className={`${col.registration} px-2`}>
        <RegistrationMark row={row} />
      </td>
      <td className={`${col.deposit} px-2 py-1`}>
        <span className="flex flex-col items-start">
          <DepositMark row={row} />
          <ResultFor model={model} kind="deposit" />
        </span>
      </td>
      <td className={`${col.attendance} px-2 py-1`}>
        <span className="flex flex-col items-start">
          <AttendanceMark row={row} started={started} />
          <ResultFor model={model} kind="attendance" />
        </span>
      </td>
    </>
  )
}

const sideCell = `px-2 ${listType.small} text-fg-secondary wrap-anywhere`

function Row({ model, props }: { model: RowModel; props: ListProps }) {
  const { row, reason } = model
  const { data } = props
  return (
    <tr
      className={`${listSize.row} border-b border-border-subtle ${rowSurface(model, 'hover:bg-surface-subtle')}`}
    >
      {data.canManage && (
        <td className={`${col.check} p-0`}>
          <CheckBox
            label={eventApplicantSelect(row.name)}
            checked={model.picked}
            busy={props.busy}
            onChange={() => props.onToggle(row.id)}
          />
        </td>
      )}
      <td className={cn('py-2 pr-4 pl-2', !data.canManage && edgeL)}>
        <span className="flex flex-wrap items-center gap-x-2.5">
          <NameButton name={row.name} onOpen={() => props.onOpen(row.id)} />
          {row.needsAttention && <AttentionMark reason={reason} />}
        </span>
      </td>
      <td className={`${col.studentId} px-2 ${listType.small} ${listType.num} text-fg-muted`}>
        {row.studentId ?? '—'}
      </td>
      {data.showAffiliation && (
        <td className={`${col.affiliation} ${sideCell}`}>{row.affiliation ?? '—'}</td>
      )}
      {data.showForm && <td className={`${col.form} ${sideCell}`}>{row.formTitle}</td>}
      <StatusCells model={model} started={props.started} />
      <td className={`${col.more} ${edgeR} text-right`}>{model.actions}</td>
    </tr>
  )
}

export function EventApplicantsTable(props: ListProps) {
  const { data, rows } = props
  const all = rows.length > 0 && rows.every(model => model.picked)
  const some = rows.some(model => model.picked)
  return (
    <table aria-label={EVENT_APPLICANTS.title} className="w-full table-fixed border-collapse">
      <thead className="sticky top-0 z-10 bg-white">
        <tr className="border-b border-border-default">
          {data.canManage && (
            <th scope="col" className={`${col.check} p-0`}>
              <CheckBox
                label={EVENT_APPLICANTS.selectPage}
                checked={all}
                mixed={some}
                busy={props.busy}
                onChange={props.onTogglePage}
              />
            </th>
          )}
          <th scope="col" className={cn(th, !data.canManage && edgeL)}>
            {EVENT_APPLICANTS.name}
          </th>
          <th scope="col" className={`${th} ${col.studentId}`}>
            {EVENT_APPLICANTS.studentId}
          </th>
          {data.showAffiliation && (
            <th scope="col" className={`${th} ${col.affiliation}`}>
              {EVENT_APPLICANTS.affiliation}
            </th>
          )}
          {data.showForm && (
            <th scope="col" className={`${th} ${col.form}`}>
              {EVENT_APPLICANTS.form}
            </th>
          )}
          <th scope="col" className={`${th} ${col.registration}`}>
            {EVENT_APPLICANTS.registration}
          </th>
          <th scope="col" className={`${th} ${col.deposit}`}>
            {EVENT_APPLICANTS.deposit}
          </th>
          <th scope="col" className={`${th} ${col.attendance}`}>
            {EVENT_APPLICANTS.attendance}
          </th>
          <th scope="col" className={`${col.more} ${edgeR}`}>
            <span className="sr-only">{EVENT_APPLICANTS.actions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(model => (
          <Row key={model.row.id} model={model} props={props} />
        ))}
      </tbody>
    </table>
  )
}
