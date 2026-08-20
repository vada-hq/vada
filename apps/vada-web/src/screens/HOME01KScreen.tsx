import type { ReactNode } from 'react'
import { DashboardSection } from '../components/DashboardSection'
import { ProgressBar } from '../components/ProgressBar'
import { StatTile } from '../components/StatTile'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import { elementByNodeId, home01k } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 홈 대시보드(HOME-01K).
//
// 명세는 무엇을 어디서 읽어 보여주는지를 갖고(summary·itemList·dataSourceKey),
// 어떻게 배치하는지는 figma.design.json이 갖는다. 그래서 이 컴포넌트가 두 단을
// 만들고 각 자리에 명세의 요소를 끼운다 — 명세에 배치를 넣으면 같은 사실이
// 두 곳에 생긴다.
//
// 사이드바와 상단 헤더는 이 화면의 요소가 아니라 모든 데스크톱 화면이 공유하는
// 앱 구조라 명세에서 제외했다(사례가 하나뿐이라 아직 일반화하지 않는다).
// 그래서 여기서도 그리지 않는다 — 명세에 없는 것을 구현이 지어내지 않는다.

const NODE = {
  briefing: '16:88',
  briefingNotices: '16:93',
  delayedTasksButton: '16:99',
  eventCounts: '16:101',
  events: '16:135',
  schedules: '16:206',
  calendarButton: '16:210',
  orgAlerts: '16:239',
  finance: '16:269',
  financeButton: '16:273',
  myTasksButton: '16:305',
} as const

function specOf<T>(nodeId: string): T {
  return elementByNodeId(home01k, nodeId).spec as T
}

// action.type이 pending인 버튼은 무엇이 일어나는지 아직 정해지지 않았다.
// 조용히 아무 일도 하지 않는 대신 note를 남겨 확인할 수 있게 한다.
function PendingLink({ spec }: { spec: ButtonSpec }) {
  const note = spec.action.type === 'pending' ? spec.action.note : undefined
  return (
    <button
      type="button"
      title={note}
      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      {spec.label}
    </button>
  )
}

function BriefingCard() {
  const summary = specOf<SummarySpec>(NODE.briefing)
  const notices = specOf<ItemListSpec>(NODE.briefingNotices)
  const button = specOf<ButtonSpec>(NODE.delayedTasksButton)

  const briefing = readObjectSource(summary.dataSourceKey!)
  const lines = readListSource(notices.dataSourceKey)

  // 16:85: 배경 #FEF2F2→red-50, radius 14→rounded-2xl, padding 21/24.5→6/7.
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl bg-red-50 p-6">
      <div className="min-w-0">
        {summary.eyebrow && (
          <p className="text-xs font-medium text-red-500">{summary.eyebrow}</p>
        )}
        <h2 className="pt-1 text-base font-semibold text-gray-900">
          {String(briefing[summary.titleField!])}
        </h2>
        <ul className="flex flex-col gap-1 pt-3">
          {lines.map((line) => (
            <li key={String(line.message)} className="text-sm text-gray-600">
              {String(line.message)}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white">
        <PendingLink spec={button} />
      </div>
    </div>
  )
}

function EventCountTiles() {
  const summary = specOf<SummarySpec>(NODE.eventCounts)
  const counts = readObjectSource(summary.dataSourceKey!)

  // 16:101은 3열 grid, 간격 14→gap-4.
  return (
    <div className="grid grid-cols-3 gap-4">
      {summary.items!.map((item) => (
        <StatTile key={item.label} label={item.label} value={`${counts[item.field!]}개`} />
      ))}
    </div>
  )
}

function EventList() {
  const spec = specOf<ItemListSpec>(NODE.events)
  const events = readListSource(spec.dataSourceKey)

  return (
    <DashboardSection title={spec.title}>
      <ul className="divide-y divide-gray-100">
        {events.map((event) => (
          <li key={String(event.title)} className="px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                {String(event.status)}
              </span>
              <span className="text-sm font-semibold text-gray-900">{String(event.title)}</span>
            </div>
            <p className="pt-2 text-xs text-gray-500">
              {[event.date, event.place, event.team].map(String).join('  ')}
            </p>
            <div className="pt-2">
              <ProgressBar
                percent={Number(event.progressPercent)}
                label={
                  event.delayedTaskCount === undefined
                    ? `준비 ${event.progressPercent}%`
                    : `준비 ${event.progressPercent}% · 지연 업무 ${event.delayedTaskCount}건`
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}

function ScheduleList() {
  const spec = specOf<ItemListSpec>(NODE.schedules)
  const button = specOf<ButtonSpec>(NODE.calendarButton)
  const schedules = readListSource(spec.dataSourceKey)

  return (
    <DashboardSection title={spec.title} action={<PendingLink spec={button} />}>
      <ul className="divide-y divide-gray-100">
        {schedules.map((schedule) => (
          <li
            key={`${schedule.date}-${schedule.title}`}
            className="flex items-center gap-4 px-5 py-3"
          >
            <span className="shrink-0 font-mono text-xs text-gray-400">
              {String(schedule.date)}
            </span>
            <span className="min-w-0 flex-1 text-sm text-gray-800">{String(schedule.title)}</span>
            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
              {String(schedule.badge)}
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}

function OrgAlertList() {
  const spec = specOf<ItemListSpec>(NODE.orgAlerts)
  const alerts = readListSource(spec.dataSourceKey)

  return (
    <DashboardSection title={spec.title}>
      <ul className="divide-y divide-gray-100">
        {alerts.map((alert) => (
          <li key={String(alert.label)} className="flex items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1 text-sm text-gray-800">{String(alert.label)}</span>
            <span className="shrink-0 text-sm font-semibold text-gray-900">
              {String(alert.count)}건
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}

function FinanceSummary() {
  const summary = specOf<SummarySpec>(NODE.finance)
  const button = specOf<ButtonSpec>(NODE.financeButton)
  const finance = readObjectSource(summary.dataSourceKey!)

  const [usage, ...tiles] = summary.items!
  const suffix = (field: string) => (field.endsWith('Percent') ? '%' : '건')

  return (
    <DashboardSection title={summary.title} action={<PendingLink spec={button} />}>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{usage.label}</span>
          <span className="text-sm font-semibold text-gray-900">
            {String(finance[usage.field!])}%
          </span>
        </div>
        <div className="pt-2">
          <ProgressBar percent={Number(finance[usage.field!])} fill />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={`${finance[tile.field!]}${suffix(tile.field!)}`}
            />
          ))}
        </div>
      </div>
    </DashboardSection>
  )
}

function MyTasksCard() {
  const spec = specOf<ButtonSpec>(NODE.myTasksButton)
  const note = spec.action.type === 'pending' ? spec.action.note : undefined

  return (
    <button
      type="button"
      title={note}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{spec.label}</span>
        {spec.description && (
          <span className="block pt-0.5 text-xs text-gray-500">{spec.description}</span>
        )}
      </span>
      {spec.badge && <span className="shrink-0 text-xs text-blue-600">{spec.badge}</span>}
    </button>
  )
}

export function HOME01KScreen(): ReactNode {
  // 16:84: padding 21→6, 아래 35→10. 두 단 16:133은 637:308 → 728:352px.
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-6 pb-10">
      <div className="mx-auto flex max-w-[1152px] flex-col gap-6">
        <BriefingCard />
        <EventCountTiles />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[728fr_352fr]">
          <div className="flex flex-col gap-6">
            <EventList />
            <ScheduleList />
          </div>
          <div className="flex flex-col gap-6">
            <OrgAlertList />
            <FinanceSummary />
            <MyTasksCard />
          </div>
        </div>
      </div>
    </div>
  )
}
