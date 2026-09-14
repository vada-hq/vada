import { useState } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { HostActionButton } from './actions'
import type { MeetingLiveActions } from './useMeetingLiveActions'
import type { MeetingLiveView } from './data'
import { ASSET, HOST, NODE, SCREEN, buttonAt, drawnValue, scalar } from './spec'

interface DiscussionAndOutcomesProps {
  view: MeetingLiveView
  actions: MeetingLiveActions
}

/** 공동 논의 내용과 자동 저장 상태를 표시한다. */
function DiscussionSection({ view, actions }: DiscussionAndOutcomesProps) {
  const [discussion, setDiscussion] = useState('')
  const { discussionHeader, discussionInput, savedNote } = view.specs

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
      <div data-node-id={NODE.discussionHeader} className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{discussionHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {discussionHeader.description}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.coeditors} className="h-5" />
          <span className="text-xs font-normal text-gray-400">
            {drawnValue(discussionHeader, 0)}
          </span>
        </span>
      </div>

      <textarea
        data-node-id={NODE.discussion}
        aria-label={discussionInput.label}
        value={discussion}
        onChange={(event) => setDiscussion(event.target.value)}
        rows={10}
        className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
      />

      <div className="flex items-center justify-between gap-4 pt-3">
        <span data-node-id={NODE.savedNote} className="text-xs font-normal text-gray-400">
          {drawnValue(savedNote, 0)}
        </span>
        <button
          type="button"
          data-node-id={NODE.attach}
          onClick={actions.press(buttonAt(NODE.attach))}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.attach} className="size-3.5" />
          {buttonAt(NODE.attach).label}
        </button>
      </div>
    </section>
  )
}

/** 현재 안건의 결정사항과 권한별 결정 동작을 표시한다. */
function DecisionSection({ view, actions }: DiscussionAndOutcomesProps) {
  const { decisionHeader, decision } = view.specs

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <span data-node-id={NODE.decisionHeader} className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{decisionHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {decisionHeader.description}
          </span>
        </span>
        {actions.host ? (
          <HostActionButton
            slot={HOST.addDecision}
            actions={actions}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          />
        ) : (
          <button
            type="button"
            data-node-id={NODE.addDecision}
            onClick={actions.press(buttonAt(NODE.addDecision))}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.addDecision} className="size-3.5" />
            {buttonAt(NODE.addDecision).label}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4">
        <p data-node-id={NODE.decision} className="text-sm font-semibold text-green-950">
          {view.current === undefined
            ? findDataSource(decision.dataSourceKey).messages.empty
            : scalar(view.current, decision.columns?.[0]?.fields?.[0])}
        </p>
        <HostActionButton
          slot={HOST.editDecision}
          actions={actions}
          className="pt-2 text-xs font-medium text-blue-600 hover:underline"
        />
      </div>
    </section>
  )
}

/** 회의에서 생긴 후속 업무 목록을 표시한다. */
function FollowUpSection({ view, actions }: DiscussionAndOutcomesProps) {
  const { followUpHeader, followUps } = view.specs
  const followUpField = (at: number) => followUps.columns?.[at]?.fields?.[0]

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <span data-node-id={NODE.followUpHeader} className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{followUpHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {followUpHeader.description}
          </span>
        </span>
        <button
          type="button"
          data-node-id={NODE.addTask}
          onClick={actions.press(buttonAt(NODE.addTask))}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addTask} className="size-3.5" />
          {buttonAt(NODE.addTask).label}
        </button>
      </div>

      <ul className="pt-4">
        {view.followUpRows.length === 0 ? (
          <li className="text-xs font-normal text-gray-400">
            {findDataSource(followUps.dataSourceKey).messages.empty}
          </li>
        ) : (
          view.followUpRows.map((task, at) => (
            <li
              key={String(task.taskId)}
              data-node-id={at === 0 ? NODE.followUps : undefined}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.followUpMark} className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-gray-800">
                  {scalar(task, followUpField(0))}
                </span>
                <span className="block pt-0.5 text-xs font-normal text-gray-500">
                  {scalar(task, followUpField(1))}
                </span>
              </span>
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.followUpMenu} className="size-4 shrink-0" />
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

export function DiscussionAndOutcomes(props: DiscussionAndOutcomesProps) {
  return (
    <>
      <DiscussionSection {...props} />
      <DecisionSection {...props} />
      <FollowUpSection {...props} />
    </>
  )
}
