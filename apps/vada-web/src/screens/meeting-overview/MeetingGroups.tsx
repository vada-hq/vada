import { useState } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { resolveParams } from '../../spec/params'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { DisplayAction, ItemListSpec } from '../../spec/types'
import { ASSET, NODE, SCREEN } from './spec'
import type { MeetingOverviewModel } from './useMeetingOverview'

export function MeetingGroups({ model }: { model: MeetingOverviewModel }) {
  return (
    <div data-node-id={NODE.groups} className="flex flex-col gap-6 pt-6 pb-12">
      {model.groups.map((group) => (
        <MeetingGroup
          key={String(group.title)}
          group={group}
          spec={model.list}
          onNavigate={model.onNavigate}
        />
      ))}
    </div>
  )
}

interface MeetingGroupProps {
  group: DataRow
  spec: ItemListSpec
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function MeetingGroup({ group, spec, onNavigate }: MeetingGroupProps) {
  const [open, setOpen] = useState(true)
  const meetings = (group[spec.group?.itemsField ?? ''] ?? []) as DataRow[]
  const collapsible = spec.group?.collapsible === true
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
              <MeetingCard
                meeting={meeting}
                itemAction={spec.itemAction}
                onNavigate={onNavigate}
              />
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
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function MeetingCard({ meeting, itemAction, onNavigate }: MeetingCardProps) {
  const [note, setNote] = useState<string | null>(null)
  const label = itemAction?.labelField ? String(meeting[itemAction.labelField]) : itemAction?.label
  const emphasis = itemAction?.emphasisField
    ? String(meeting[itemAction.emphasisField])
    : 'secondary'

  const openMeeting = () => {
    if (itemAction === undefined) return
    if (itemAction.type === 'pending') {
      setNote(itemAction.note)
      return
    }
    const target = targetScreenOf(itemAction, meeting)
    if (target === null) {
      setNote(
        `이 회의가 어느 상세로 가는지 명세의 갈래에 없습니다: ${String(
          meeting[(itemAction as { targetField?: string }).targetField ?? ''] ?? '',
        )}`,
      )
      return
    }
    onNavigate(target, resolveParams(paramsOf(itemAction), { row: meeting }))
  }

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
            <MeetingMeta asset={ASSET.date} value={String(meeting.startAt)} />
            <MeetingMeta asset={ASSET.place} value={String(meeting.place)} />
            <MeetingMeta asset={ASSET.host} value={String(meeting.host)} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-6">
          <Stat label="참가자" value={String(meeting.attendees)} />
          <Stat label="안건" value={String(meeting.agenda)} />
          <Stat label="회의록 상태" value={String(meeting.minutesStatus)} valueClass="text-gray-600" />
          <button
            type="button"
            onClick={openMeeting}
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

function MeetingMeta({ asset, value }: { asset: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <FigmaAsset screenId={SCREEN} nodeId={asset} className="size-3" />
      {value}
    </span>
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
