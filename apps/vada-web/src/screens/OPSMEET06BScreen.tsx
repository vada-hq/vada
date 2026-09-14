import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Built } from '../components/Built'
import { FigmaAsset } from '../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
} from '../design/tones'
import { readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { findDataSource } from '../data-sources/definitions'
import { scalarValue } from '../data-sources/values'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeet06a, opsMeet06b } from '../spec/screens'
import type { SummarySpec } from '../spec/types'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ScopeDraft } from '../state/scopes'
import { AgendaCards } from './meeting-minutes/AgendaCards'
import { AgendaEditor } from './meeting-minutes/AgendaEditor'
import {
  CompleteMinutesAction,
  MinutesCompletionConditions,
} from './meeting-minutes/MinutesCompletion'
import { MinutesSummary } from './meeting-minutes/MinutesSummary'
import {
  ASSET,
  BASE,
  BASE_NODE,
  BREADCRUMB_SEPARATORS,
  NODE,
  SCREEN,
  listAt,
  summaryAt,
} from './meeting-minutes/spec'

// 회의록 정리 — 진행 권한자(OPS-MEET-06B).
//
// 이 파일은 화면 진입과 데이터 조립만 맡는다. 비동기 안건 선택, 완료 조건,
// 회의록 요약, 안건 카드, 선택 안건 편집은 meeting-minutes의 각 모듈이 담당한다.

interface OPSMEET06BScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(meetingMinutesDraft). */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEET06BScreen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: OPSMEET06BScreenProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  const field = useFieldDraft({
    elements: opsMeet06b.elements,
    draft,
    onChangeDraft,
    screenParams,
  })

  const banner = elementByNodeId(opsMeet06a, BASE_NODE.banner).spec as SummarySpec
  const facts = summaryAt(NODE.facts)
  const agendas = listAt(NODE.agendas)
  const agendaFollowUps = listAt(NODE.agendaFollowUps)
  const meta = opsMeet06b.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-06B의 화면 카피가 없습니다.')
  }

  const missingParam = (opsMeet06b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const query = resolveParams(banner.params, { screenParams })
  const detail =
    missingParam === undefined ? readObjectSourceOrNull(banner.dataSourceKey ?? '', query) : null

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet06b.screenId}
        activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-gray-500">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  const followUpRows = readListSource(
    agendaFollowUps.dataSourceKey,
    resolveParams(agendaFollowUps.params, { screenParams }),
  )
  const bannerTone = scalarValue(detail, banner.toneField)
  const breadcrumb = opsMeet06b.breadcrumb

  return (
    <AppShell
      screenId={opsMeet06b.screenId}
      activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={meta.title}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalarValue(detail, item.field),
            )}
          />
        )
      }
      headerAction={
        <Built what="정리 완료">
          <CompleteMinutesAction
            screenParams={screenParams}
            submitAction={submitAction}
            onNavigate={onNavigate}
          />
        </Built>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        {submitAction.errorMessage === null ? null : (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
          >
            {submitAction.errorMessage}
          </p>
        )}
        {submitAction.pendingNote === null ? null : (
          <p
            role="status"
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {submitAction.pendingNote}
          </p>
        )}

        <section
          data-design-rule="state-banner"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
              >
                {scalarValue(detail, banner.titleField)}
              </span>
              {(banner.status ?? []).map((badge) => (
                <span
                  key={badge.field}
                  data-design-state
                  data-design-rule="state-chip"
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    STATE_CHIP[scalarValue(detail, badge.toneField)] ?? NEUTRAL_CHIP
                  }`}
                >
                  {scalarValue(detail, badge.field)}
                </span>
              ))}
            </span>
            <span
              className={`block pt-1 text-xs font-normal ${
                BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE
              }`}
            >
              {scalarValue(detail, banner.descriptionField)}
            </span>
          </span>
        </section>

        <div data-node-id={NODE.facts} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(facts.items ?? []).map((item) => (
            <span
              key={item.field}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <span className="block text-xs font-normal text-gray-400">{item.label}</span>
              <span className="block pt-1 text-xs font-bold text-gray-800">
                {scalarValue(detail, item.field)}
              </span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <MinutesSummary
              screenParams={screenParams}
              submitAction={submitAction}
              onNavigate={onNavigate}
              onPending={setNote}
            />
            {note === null ? null : (
              <p role="status" className="text-xs font-medium text-gray-500">
                {note}
              </p>
            )}
            <AgendaCards agendaRows={agendaRows} followUpRows={followUpRows} />
          </div>

          <div className="flex flex-col gap-4">
            <AgendaEditor
              screenParams={screenParams}
              draft={draft}
              field={field}
              agendaRows={agendaRows}
              followUpRows={followUpRows}
              onPending={setNote}
            />
            <Built what="정리 완료 조건">
              <MinutesCompletionConditions screenParams={screenParams} />
            </Built>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// 이 화면은 06A의 변형이지만 파일이 따로 있다. 검사는 바탕 화면의 원문을 먼저 본다.
export { BASE }
