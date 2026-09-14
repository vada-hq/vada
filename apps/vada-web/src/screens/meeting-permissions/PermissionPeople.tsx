import { useState } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { PendingBox } from '../../components/PendingBox'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import type { ItemListSpec } from '../../spec/types'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { readPermissionPeople } from './data'
import type { MeetingPermissionView } from './data'
import { ASSET, NODE, SCREEN, scalar } from './spec'

interface PermissionPeopleProps {
  view: MeetingPermissionView
  screenParams: Record<string, string>
}

/** 검색 상태, 참가자 조회, 줄별 권한 동작을 함께 관리한다. */
export function PermissionPeople({ view, screenParams }: PermissionPeopleProps) {
  const { peopleHeader, people, query, filter } = view.specs
  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const rows = readPermissionPeople(view, screenParams, queryValue)
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]

  const chipsOf = (person: DataRow): DataRow[] => {
    const value = person[personField(1) ?? '']
    return Array.isArray(value) ? value : []
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div data-node-id={NODE.peopleHeader} className="flex items-start justify-between gap-4 px-5 pt-4">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{peopleHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {scalar(view.permission, (peopleHeader.items ?? [])[0]?.field)}
          </span>
        </span>
        <span className="shrink-0">
          {(peopleHeader.status ?? []).map((badge) => (
            <MeetingStateChip
              key={badge.field}
              label={scalar(view.permission, badge.field)}
              tone={scalar(view.permission, badge.toneField)}
            />
          ))}
        </span>
      </div>

      <div className="px-5 py-4">
        <label
          data-node-id={NODE.query}
          className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
          <input
            aria-label={query.label}
            type={query.inputType}
            value={queryValue}
            placeholder={query.placeholder ?? query.label}
            onChange={(event) => setQueryValue(event.target.value)}
            className="min-w-0 flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </label>
        <PendingBox
          nodeId={NODE.filter}
          spec={filter}
          className="h-9 w-28 shrink-0 rounded-[5px] border border-gray-300 bg-white"
        />
      </div>

      <ul data-node-id={NODE.people} className="border-t border-gray-100">
        {rows.length === 0 ? (
          <li className="px-5 py-4 text-xs font-normal text-gray-400">
            {findDataSource(people.dataSourceKey).messages.empty}
          </li>
        ) : (
          rows.map((person, at) => (
            <li
              key={String(person.memberId)}
              className={`flex items-center gap-3 px-5 py-3 ${
                at === rows.length - 1 ? '' : 'border-b border-gray-100'
              }`}
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.personAvatar} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">
                    {scalar(person, personField(0))}
                  </span>
                  {chipsOf(person).map((chip, index) => (
                    <MeetingStateChip
                      key={`${String(person.memberId)}-${index}`}
                      label={String(chip.label ?? '')}
                      tone={String(chip.tone ?? '')}
                    />
                  ))}
                </span>
                <span className="block pt-0.5 text-xs font-normal text-gray-400">
                  {scalar(person, personField(2))}
                </span>
              </span>
              <RowAction person={person} spec={people} onNote={setNote} />
            </li>
          ))
        )}
      </ul>

      {note === null ? null : (
        <p role="status" className="px-5 pb-4 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}
    </section>
  )
}

function RowAction({
  person,
  spec,
  onNote,
}: {
  person: DataRow
  spec: ItemListSpec
  onNote: (note: string) => void
}) {
  const action = spec.itemAction
  if (action === undefined) return null
  const label = action.labelField === undefined ? action.label : String(person[action.labelField] ?? '')
  if (label === undefined || label === '') return null
  const emphasis =
    action.emphasisField === undefined
      ? 'secondary'
      : String(person[action.emphasisField] ?? 'secondary')

  return (
    <button
      type="button"
      onClick={() => {
        if (action.type === 'pending') onNote(action.note)
      }}
      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
        emphasis === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}
