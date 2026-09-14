import type { ReactNode } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { STATE_TEXT } from '../../design/tones'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { scalarValue as scalar } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { DataRow } from '../../data-sources/definitions'
import type { DisplayAction, ItemListSpec, SummarySpec } from '../../spec/types'
import { ASSET, NODE, SCREEN, listAt, rowsOf, summaryAt } from './spec'

interface ArchiveDocumentSectionsProps {
  screenParams: Record<string, string>
  activeKey: string
  onNote: (note: string) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function ArchiveDocumentSections({
  screenParams, activeKey, onNote, onNavigate,
}: ArchiveDocumentSectionsProps) {
  const objectOf = (spec: SummarySpec) =>
    readObjectSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))
  const listOf = (spec: ItemListSpec) =>
    readListSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))
  const openEvidence = (action: DisplayAction, row: DataRow) => () => {
    if (action.type === 'pending') {
      onNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target !== null) onNavigate(target, resolveParams(paramsOf(action), { screenParams, row }))
  }
  const timeline = listAt(NODE.timeline)
  const [timelineDate, timelineTitle, timelineDescription] = timeline.columns ?? []
  const evidence = listAt(NODE.evidence)
  const [evidenceTitle, evidenceDetail] = evidence.columns ?? []
  const retro = listAt(NODE.retro)
  const [retroLabel, retroCause, retroOwner] = retro.columns ?? []
  const handover = listAt(NODE.handover)
  const [handoverLabel, handoverValue] = handover.columns ?? []

  return (
    <div className="flex flex-col gap-4">
      {[NODE.overview, NODE.outcome].map((nodeId) => {
        const spec = summaryAt(nodeId)
        return (
          <LabelledSection
            key={nodeId}
            nodeId={nodeId}
            spec={spec}
            row={objectOf(spec)}
            current={activeKey === (nodeId === NODE.overview ? 'overview' : 'outcome')}
          />
        )
      })}

      <SectionCard nodeId={NODE.timeline} title={timeline.title} current={false}>
        {listOf(timeline).map((row) => (
          <div key={scalar(row, 'id')} className="flex gap-4 px-6 py-3">
            <span className="w-14 shrink-0 pt-0.5 text-xs text-gray-400">
              {scalar(row, (timelineDate?.fields ?? [])[0])}
            </span>
            <span className="block border-l border-gray-100 pl-4">
              <span className="block text-sm font-semibold text-gray-800">
                {scalar(row, (timelineTitle?.fields ?? [])[0])}
              </span>
              <span className="block pt-0.5 text-xs text-gray-500">
                {scalar(row, (timelineDescription?.fields ?? [])[0])}
              </span>
            </span>
          </div>
        ))}
      </SectionCard>

      {(() => {
        const spec = summaryAt(NODE.onSite)
        return <LabelledSection nodeId={NODE.onSite} spec={spec} row={objectOf(spec)} current={activeKey === 'onSite'} />
      })()}

      <SectionCard nodeId={NODE.evidence} title={evidence.title} current={false}>
        {listOf(evidence).map((row) => {
          const label = evidence.itemAction?.labelField === undefined
            ? ''
            : scalar(row, evidence.itemAction.labelField)
          return (
            <div
              key={scalar(row, 'id')}
              className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-3 last:border-b-0"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-800">
                  {scalar(row, (evidenceTitle?.fields ?? [])[0])}
                </span>
                <span className="block pt-0.5 text-xs text-gray-500">
                  {scalar(row, (evidenceDetail?.fields ?? [])[0])}
                </span>
              </span>
              {label === '' || evidence.itemAction === undefined ? null : (
                <button
                  type="button"
                  onClick={openEvidence(evidence.itemAction, row)}
                  className="shrink-0 rounded text-xs font-medium text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  {label}
                </button>
              )}
            </div>
          )
        })}
        <p data-node-id={NODE.evidenceNote} className="px-6 py-3 text-xs text-gray-400">
          {summaryAt(NODE.evidenceNote).title}
        </p>
      </SectionCard>

      <SectionCard nodeId={NODE.retro} title={retro.title} current={false}>
        {listOf(retro).map((group, index) => (
          <div key={scalar(group, 'groupLabel')} className={`px-6 py-4 ${index === 0 ? '' : 'border-t border-gray-100'}`}>
            <span className="block text-xs font-bold text-gray-400">
              {scalar(group, ((retro.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
            </span>
            {rowsOf(group, retro.group?.itemsField).map((row) => (
              <div key={scalar(row, 'key')} className="flex items-start gap-2 pt-2">
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.retro[index] ?? ASSET.retro[0]} className="mt-0.5 size-3.5 shrink-0" />
                <span className="block">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-700">{scalar(row, (retroLabel?.fields ?? [])[0])}</span>
                    {scalar(row, (retroOwner?.fields ?? [])[0]) === '' ? null : (
                      <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {scalar(row, (retroOwner?.fields ?? [])[0])}
                      </span>
                    )}
                  </span>
                  {scalar(row, (retroCause?.fields ?? [])[0]) === '' ? null : (
                    <span className="block pt-1 text-xs text-gray-500">{scalar(row, (retroCause?.fields ?? [])[0])}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </SectionCard>

      <SectionCard nodeId={NODE.handover} title={handover.title} current={false}>
        {listOf(handover).map((group, index) => (
          <div key={scalar(group, 'groupLabel')} className={`px-6 py-4 ${index === 0 ? '' : 'border-t border-gray-100'}`}>
            <span className="block text-xs font-bold text-gray-400">
              {scalar(group, ((handover.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
            </span>
            {rowsOf(group, handover.group?.itemsField).map((row) => {
              const value = scalar(row, (handoverValue?.fields ?? [])[0])
              const tone = scalar(row, handoverLabel?.toneField)
              return (
                <span key={scalar(row, 'key')} className="flex items-baseline gap-4 pt-2">
                  <span className={`text-sm ${value === '' ? (STATE_TEXT[tone] ?? 'text-gray-700') : 'w-28 shrink-0 text-xs text-gray-400'}`}>
                    {scalar(row, (handoverLabel?.fields ?? [])[0])}
                  </span>
                  {value === '' ? null : <span className="text-sm text-gray-700">{value}</span>}
                </span>
              )
            })}
          </div>
        ))}
        <p data-node-id={NODE.nextOwner} className="border-t border-gray-100 px-6 py-3 text-sm font-semibold text-gray-700">
          {scalar(objectOf(summaryAt(NODE.nextOwner)), (summaryAt(NODE.nextOwner).items ?? [])[0]?.field)}
        </p>
      </SectionCard>
    </div>
  )
}

function SectionCard({ nodeId, title, current, children }: { nodeId: string; title: string | undefined; current: boolean; children: ReactNode }) {
  return (
    <section data-node-id={nodeId} className={`overflow-hidden rounded-xl border bg-white ${current ? 'border-blue-300' : 'border-gray-200'}`}>
      <header className="border-b border-gray-100 bg-gray-50 px-6 py-3"><h2 className="text-sm font-bold text-gray-900">{title}</h2></header>
      {children}
    </section>
  )
}

function LabelledSection({ nodeId, spec, row, current }: { nodeId: string; spec: SummarySpec; row: DataRow; current: boolean }) {
  return (
    <SectionCard nodeId={nodeId} title={spec.title} current={current}>
      <dl className="px-6 py-4">
        {(spec.items ?? []).map((item) => (
          <div key={item.field} className="flex items-baseline gap-4 py-1.5">
            <dt className="w-32 shrink-0 text-xs text-gray-400">{item.label}</dt>
            <dd className="text-sm text-gray-700">{scalar(row, item.field)}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
