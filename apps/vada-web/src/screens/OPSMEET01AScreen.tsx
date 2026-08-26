import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { elementByNodeId, opsMeet01a } from '../spec/screens'
import type { DisplayAction, InputSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 회의 목록(OPS-MEET-01A).
//
// 목록이 묶음으로 온다 — 묶음 하나가 행사 하나고, 어디에도 속하지 않는 회의는
// '정기·상시 회의'로 묶여 온다. 칸반의 열과 다르다: 열은 명세에 고정이라 요소를
// 넷 등록했지만, 여기는 묶음 수가 데이터에 달려 요소가 하나다(itemList.group).
//
// 묶음 머리의 '총 N건'은 명세에 없다 — 그 묶음의 항목 수가 곧 건수다(TASK-01과 같다).
// 반면 '가장 가까운 회의'는 서버가 준다. 그려진 것을 보면 완료는 빼고 취소는 넣는데,
// 그 규칙을 화면이 유도할 수 없기 때문이다.

const SCREEN = 'OPS-MEET-01A'

const NODE = {
  attention: '18:418',
  query: '18:432',
  groups: '18:437',
} as const

// 어떤 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는 자리는
// 첫 것의 nodeId를 본으로 쓴다 — 같은 그림이면 하나만 그려도 대조가 통과한다.
const ASSET = {
  attention: '18:420',
  collapse: '18:441',
  clock: '18:448',
  date: '18:464',
  place: '18:471',
  host: '18:476',
} as const

interface OPSMEET01AScreenProps {
  onNavigate: (screenId: string) => void
}

export function OPSMEET01AScreen({ onNavigate }: OPSMEET01AScreenProps) {
  const attention = elementByNodeId(opsMeet01a, NODE.attention).spec as SummarySpec
  const query = elementByNodeId(opsMeet01a, NODE.query).spec as InputSpec
  const list = elementByNodeId(opsMeet01a, NODE.groups).spec as ItemListSpec

  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const attentionRow = readObjectSource(attention.dataSourceKey ?? '')
  const groups = readListSource(list.dataSourceKey, { query: queryValue })

  return (
    <AppShell
      screenId={opsMeet01a.screenId}
      eyebrow={opsMeet01a.meta?.eyebrow}
      title={opsMeet01a.meta?.title ?? opsMeet01a.screenId}
      onNavigate={onNavigate}
    >
      {/* 안내 18:418: 흰 카드, 좌측 아이콘+문구, 우측 건수 */}
      <div
        data-node-id={NODE.attention}
        className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
      >
        <span className="flex items-center gap-3">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.attention} className="size-8 shrink-0" />
          <span>
            <span className="block text-xs font-bold text-gray-800">{attention.title}</span>
            <span className="block text-xs text-gray-500">{attention.description}</span>
          </span>
        </span>
        {/* design은 이름과 건수를 한 텍스트 노드로 그린다 — 쪼개지 않는다. */}
        <span className="shrink-0 text-xs text-gray-400">
          {(attention.items ?? [])
            .map((item) => `${item.label} ${attentionRow[item.field ?? '']}${item.unit ?? ''}`)
            .join(' ')}
        </span>
      </div>

      {/* 거르는 줄 18:431. 드롭다운 둘(18:435·18:436)은 선택지가 디자인에 비어 있어
          명세에서 뺐다 — MY-01과 같은 자리다(BACKLOG). */}
      <div className="flex items-center gap-3 pt-4">
        {/* 등록 노드는 테두리를 가진 칸이다(18:432). 안쪽 input에 달면 대조가
            그 칸의 배경·테두리를 볼 자리가 없어진다. */}
        <label
          data-node-id={NODE.query}
          className="flex min-w-0 flex-1 items-center rounded-md border border-gray-200 bg-white px-4 py-2"
        >
          <input
            aria-label={query.label}
            type={query.inputType}
            value={queryValue}
            placeholder={query.placeholder ?? query.label}
            onChange={(event) => setQueryValue(event.target.value)}
            className="min-w-0 flex-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </label>
      </div>

      <div data-node-id={NODE.groups} className="flex flex-col gap-6 pt-6 pb-12">
        {groups.map((group) => (
          <MeetingGroup key={String(group.title)} group={group} spec={list} />
        ))}
      </div>
    </AppShell>
  )
}

interface MeetingGroupProps {
  group: DataRow
  spec: ItemListSpec
}

function MeetingGroup({ group, spec }: MeetingGroupProps) {
  // 접힘은 화면 안의 상태다. 데이터를 다시 조회하지 않고, 처음에는 펴져 있다.
  const [open, setOpen] = useState(true)
  const meetings = (group[spec.group?.itemsField ?? ''] ?? []) as DataRow[]
  const collapsible = spec.group?.collapsible === true

  // 묶음의 머리가 어느 조각을 그리는지는 명세가 말한다. 이 자리가 없던 동안 화면이
  // 'title'과 'nextMeetingNote'를 코드에 박아 썼고, 출처의 조각 이름이 바뀌어도
  // 검증기가 아무 말도 하지 못했다: 명세가 가리키지 않는 조각은 검사할 수 없다.
  const headerAt = (at: number) => {
    const field = spec.group?.headerFields?.[at]?.fields?.[0]
    if (field === undefined) {
      throw new Error(`묶음 머리의 ${at + 1}번째 조각이 명세에 없습니다.`)
    }
    return String(group[field] ?? '')
  }

  const heading = (
    <>
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.collapse} className="size-3.5 shrink-0" />
      <span className="text-sm font-bold text-gray-800">{headerAt(0)}</span>
      {/* 건수는 명세에 없다. 이 묶음의 항목 수가 곧 건수다. */}
      <span className="text-xs text-gray-400">총 {meetings.length}건</span>
    </>
  )

  return (
    <section className="flex flex-col gap-2.5">
      <header className="flex items-center justify-between px-2">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((previous) => !previous)}
            className="flex items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {heading}
          </button>
        ) : (
          <span className="flex items-center gap-2">{heading}</span>
        )}
        <span className="flex shrink-0 items-center gap-1.5">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.clock} className="size-3" />
          <span className="text-xs text-gray-400">{headerAt(1)}</span>
        </span>
      </header>
      {open && (
        <ul className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <li key={String(meeting.title)}>
              <MeetingCard meeting={meeting} itemAction={spec.itemAction} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface MeetingCardProps {
  meeting: DataRow
  itemAction: DisplayAction | undefined
}

function MeetingCard({ meeting, itemAction }: MeetingCardProps) {
  const [note, setNote] = useState<string | null>(null)
  // 문구와 강조도를 데이터가 준다. 회의 상태에 따라 다르기 때문이다.
  const label = itemAction?.labelField ? String(meeting[itemAction.labelField]) : itemAction?.label
  const emphasis = itemAction?.emphasisField
    ? String(meeting[itemAction.emphasisField])
    : 'secondary'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                STATE_CHIP[String(meeting.statusTone)] ?? NEUTRAL_CHIP
              }`}
            >
              {String(meeting.status)}
            </span>
            <span className="text-sm font-bold text-gray-900">{String(meeting.title)}</span>
            {meeting.badge === undefined ? null : (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {String(meeting.badge)}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-4 pt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.date} className="size-3" />
              {String(meeting.startAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.place} className="size-3" />
              {String(meeting.place)}
            </span>
            <span className="flex items-center gap-1.5">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.host} className="size-3" />
              {String(meeting.host)}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          {/* 라벨은 design이 정한 카피다. 값만 데이터에서 온다. */}
          <Stat label="참가자" value={String(meeting.attendees)} />
          <Stat label="안건" value={String(meeting.agenda)} />
          <Stat
            label="회의록 상태"
            value={String(meeting.minutesStatus)}
            valueClass="text-gray-600"
          />
          <button
            type="button"
            onClick={() => {
              if (itemAction === undefined || itemAction.type === 'navigate') {
                return
              }
              setNote(itemAction.note)
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
              emphasis === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        </div>
      </div>
      {note === null ? null : (
        <p role="status" className="pt-2 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass = 'text-gray-700',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <span className="block text-right">
      <span className="block text-[10px] font-semibold text-gray-400">{label}</span>
      <span className={`block text-xs font-bold ${valueClass}`}>{value}</span>
    </span>
  )
}
