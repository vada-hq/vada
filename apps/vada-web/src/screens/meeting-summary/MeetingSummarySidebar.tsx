import { Built } from '../../components/Built'
import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { STATE_CHIP } from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import type { MeetingSummaryActions } from './actions'
import type { MeetingSummaryView } from './data'
import { ABSENTEE, ASSET, NODE, SCREEN, scalar } from './spec'

interface MeetingSummarySidebarProps {
  view: MeetingSummaryView
  actions: MeetingSummaryActions
}

function CountChip({ label }: { label: string }) {
  if (label === '') return null
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP.gray}`}>{label}</span>
}

/** 전체 후속 업무와 불참자에게 배정된 업무를 표시한다. */
function FollowUpCards({ view, actions }: MeetingSummarySidebarProps) {
  const { followUpHeader, followUps } = view.specs
  const variant = view.variant
  const followUpField = (at: number) => followUps.columns?.[at]?.fields?.[0]
  const pressFollowUp = () => {
    if (followUps.itemAction?.type === 'pending') actions.setNote(followUps.itemAction.note)
  }

  return (
    <>
      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div data-node-id={NODE.followUpHeader} className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-gray-800">{followUpHeader.title}</h3>
          <CountChip label={scalar(view.detail, (followUpHeader.items ?? [])[0]?.field)} />
        </div>
        <ul data-node-id={NODE.followUps} className="pt-3">
          {view.followUpRows.length === 0 ? (
            <li className="text-xs leading-5 text-gray-500">
              {findDataSource(followUps.dataSourceKey ?? '').messages.empty}
            </li>
          ) : (
            view.followUpRows.map((task) => (
              <li key={String(task.taskId)} className="py-1.5">
                <button type="button" onClick={pressFollowUp} className="block w-full text-left">
                  <span className="block text-xs font-bold text-gray-800">
                    {scalar(task, followUpField(0))}
                  </span>
                  <span className="block pt-0.5 text-xs text-gray-500">
                    {scalar(task, followUpField(1))}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {variant === null ? null : (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div
            data-node-id={ABSENTEE.myFollowUpHeader}
            className="flex items-center justify-between gap-2"
          >
            <h3 className="text-xs font-bold text-gray-900">{variant.myFollowUpHeader.title}</h3>
            <CountChip
              label={scalar(view.detail, (variant.myFollowUpHeader.items ?? [])[0]?.field)}
            />
          </div>
          <ul data-node-id={ABSENTEE.myFollowUps} className="pt-3">
            {view.myFollowUpRows.length === 0 ? (
              <li className="text-xs leading-5 text-gray-500">
                {findDataSource(variant.myFollowUps.dataSourceKey ?? '').messages.empty}
              </li>
            ) : (
              view.myFollowUpRows.map((task) => (
                <li key={String(task.taskId)} className="py-1.5">
                  <span className="block text-xs font-bold text-gray-800">
                    {scalar(task, variant.myFollowUps.columns?.[0]?.fields?.[0])}
                  </span>
                  <span className="block pt-0.5 text-xs text-gray-500">
                    {scalar(task, variant.myFollowUps.columns?.[1]?.fields?.[0])}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </>
  )
}

function Attendance({ view }: { view: MeetingSummaryView }) {
  const { people } = view.specs
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]

  return (
    <section data-node-id={NODE.people} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h3 className="text-xs font-bold text-gray-800">{people.title}</h3>
      <Built what={people.title ?? '참가 결과'} read={view.readPeople}>
        {(peopleRows) => (
          <ul className="pt-2">
            {peopleRows.length === 0 ? (
              <li className="py-2 text-xs text-gray-500">
                {findDataSource(people.dataSourceKey ?? '').messages.empty}
              </li>
            ) : (
              peopleRows.map((person) => (
                <li key={String(person.memberId)} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 text-xs text-gray-700">
                    {scalar(person, personField(0))}
                  </span>
                  <MeetingStateChip
                    label={scalar(person, personField(1))}
                    tone={scalar(person, people.columns?.[1]?.toneField)}
                  />
                </li>
              ))
            )}
          </ul>
        )}
      </Built>
    </section>
  )
}

function Documents({ view, actions }: MeetingSummarySidebarProps) {
  const { documents } = view.specs
  return (
    <section data-node-id={NODE.documents} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h3 className="text-xs font-bold text-gray-800">{documents.title}</h3>
      <Built what={documents.title ?? '관련 자료'} read={view.readDocuments}>
        {(documentRows) => (
          <ul className="pt-2">
            {documentRows.length === 0 ? (
              <li className="py-2 text-xs text-gray-500">
                {findDataSource(documents.dataSourceKey ?? '').messages.empty}
              </li>
            ) : (
              documentRows.map((file, at) => (
                <li key={String(file.documentId)} className="flex items-center gap-2 py-1.5">
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.document} className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 text-xs text-gray-600">
                    {scalar(file, documents.columns?.[0]?.fields?.[0])}
                  </span>
                  <button
                    type="button"
                    data-node-id={at === 0 ? NODE.documentDownload : undefined}
                    aria-label={view.documentDownload?.label}
                    onClick={actions.download(view.documentDownload, file)}
                    className="shrink-0"
                  >
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.download} className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </Built>
    </section>
  )
}

export function MeetingSummarySidebar(props: MeetingSummarySidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      <FollowUpCards {...props} />
      <Attendance view={props.view} />
      <Documents {...props} />
    </div>
  )
}
