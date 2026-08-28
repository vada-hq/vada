import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { CHOICE_CHIP, INFO_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readListSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { elementByNodeId, evt00a } from '../spec/screens'
import type { ButtonSpec, DisplayAction, InputSpec, ItemListSpec, SelectSpec } from '../spec/types'
//
// 행사 목록(EVT-00A).
//
// 회의 목록(OPS-MEET-01A)과 같은 목록이지만 묶음이 없다 — 행사가 곧 항목이다.
// 그래서 지난 사이클에 넓힌 itemList.group을 여기서는 쓰지 않는다.
//
// 새로 생긴 자리는 하나다: **머리 오른쪽의 화면 동작**('완료된 행사 보기 →').
// 셸이 아니라 이 화면의 요소이므로 screen.json에 button으로 등록돼 있고, 그려지는
// 자리만 AppShell의 headerAction이 내준다.

const SCREEN = 'EVT-00A'

const NODE = {
  completed: '20:4142',
  query: '20:4153',
  status: '20:4155',
  list: '20:4167',
} as const

// 되풀이되는 자리는 첫 항목의 nodeId를 본으로 쓴다 — 같은 그림이면 하나만 그려도
// 대조가 통과한다(내용으로 묶는다).
const ASSET = {
  startAt: '20:4178',
  place: '20:4185',
  host: '20:4190',
  alert: '20:4262',
} as const

interface EVT00AScreenProps {
  onNavigate: (screenId: string) => void
}

export function EVT00AScreen({ onNavigate }: EVT00AScreenProps) {
  const completed = elementByNodeId(evt00a, NODE.completed).spec as ButtonSpec
  const query = elementByNodeId(evt00a, NODE.query).spec as InputSpec
  const status = elementByNodeId(evt00a, NODE.status).spec as SelectSpec
  const list = elementByNodeId(evt00a, NODE.list).spec as ItemListSpec

  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const [statusValue, setStatusValue] = useState(status.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const statusSource = getOptionSource(status.optionsSource.key)
  const statusOptions = statusSource.type === 'static' ? statusSource.options : []
  const events = readListSource(list.dataSourceKey, {
    query: queryValue,
    status: statusValue,
  })

  return (
    <AppShell
      screenId={evt00a.screenId}
      activeNavigationScreenId={evt00a.activeNavigationScreenId}
      eyebrow={evt00a.meta?.eyebrow}
      title={evt00a.meta?.title ?? evt00a.screenId}
      description={evt00a.meta?.description}
      onNavigate={onNavigate}
      headerAction={
        <button
          type="button"
          data-node-id={NODE.completed}
          disabled={completed.initiallyDisabled}
          onClick={() => {
            if (completed.action.type === 'navigate') {
              onNavigate(completed.action.targetScreenId)
              return
            }
            if (completed.action.type === 'pending') {
              setNote(completed.action.note)
            }
          }}
          className="rounded text-xs font-medium text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {completed.label}
        </button>
      }
    >
      {note === null ? null : (
        <p role="status" className="pb-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      <div className="flex items-center gap-3 pb-4">
        {/* 등록 노드는 테두리를 가진 칸이다(20:4153). design은 그 칸에 배경을 주지
            않았다 — 아이콘은 칸 밖의 형제라 이 안에 들어오지 않는다. */}
        <label
          data-node-id={NODE.query}
          className="flex w-full min-w-0 max-w-[280px] items-center gap-2 rounded-md border border-gray-200 px-3 py-2"
        >
          <FigmaAsset screenId={SCREEN} nodeId="20:4150" className="size-3.5 shrink-0" />
          <input
            aria-label={query.label}
            type={query.inputType}
            value={queryValue}
            placeholder={query.placeholder ?? query.label}
            onChange={(event) => setQueryValue(event.target.value)}
            className="min-w-0 flex-1 text-sm text-gray-700 placeholder:text-gray-700 focus:outline-none"
          />
        </label>

        {/* 진행 단계로 거르는 버튼 묶음. 칸반의 범위 토글(TASK-01 18:122)과 같은
            select.choiceGroup인데 design이 그린 형태가 다르다 — 그쪽은 한 덩이
            안의 알약이고 여기는 낱개 버튼이다. 형태는 design이 갖는다. */}
        <div
          data-node-id={NODE.status}
          data-design-rule="choice-chip"
          role="radiogroup"
          aria-label={status.label ?? '진행 단계'}
          className="flex shrink-0 gap-2"
        >
          {statusOptions.map((option) => {
            const value = String(option.value)
            const selected = value === statusValue
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStatusValue(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div data-node-id={NODE.list} className="flex flex-col gap-3 pb-12">
        {events.map((event) => (
          <EventCard key={String(event.title)} event={event} itemAction={list.itemAction} />
        ))}
      </div>
    </AppShell>
  )
}

interface EventCardProps {
  event: DataRow
  itemAction: DisplayAction | undefined
}

function EventCard({ event, itemAction }: EventCardProps) {
  const [note, setNote] = useState<string | null>(null)
  // 딱지는 개수가 행사마다 다르다. 회의 목록에서 넓힌 조각 중첩(fields[].fields)이
  // 묶음이 아니라 한 항목 안에서 쓰이는 첫 사례다.
  const highlights = (event.highlights ?? []) as DataRow[]

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-label={`${String(event.title)} ${itemAction?.label ?? ''}`.trim()}
        onClick={() => {
          if (itemAction === undefined || itemAction.type === 'navigate') {
            return
          }
          setNote(itemAction.note)
        }}
        className="block w-full px-5 py-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <span className="flex">
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              STATE_CHIP[String(event.statusTone)] ?? NEUTRAL_CHIP
            }`}
          >
            {String(event.status)}
          </span>
        </span>
        <span className="block pt-2 text-sm font-semibold text-gray-900">
          {String(event.title)}
        </span>

        <span className="flex flex-wrap items-center gap-4 pt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.startAt} className="size-3" />
            {String(event.startAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.place} className="size-3" />
            {String(event.place)}
          </span>
          <span className="flex items-center gap-1.5">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.host} className="size-3" />
            {String(event.host)}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-2 pt-2.5">
          {highlights.map((highlight) => (
            <span
              key={String(highlight.label)}
              className={`rounded px-2 py-1 text-xs ${INFO_CHIP}`}
            >
              {String(highlight.label)}
            </span>
          ))}
        </span>

        {event.alert === undefined ? null : (
          <span className="flex items-center gap-1.5 pt-2.5 text-xs font-medium text-orange-600">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.alert} className="size-3" />
            {String(event.alert)}
          </span>
        )}

        <span className="block pt-2.5 text-xs text-gray-400">
          {String(event.lastModifiedNote)}
        </span>
      </button>
      {note === null ? null : (
        <p
          role="status"
          className="border-t border-gray-200 px-5 py-2 text-xs font-medium text-gray-500"
        >
          {note}
        </p>
      )}
    </div>
  )
}
