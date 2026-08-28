import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { useSubmitAction } from '../spec/useSubmitAction'
import { resolveParams } from '../spec/params'
import type { ScopeDraft } from '../state/scopes'
import { elementByNodeId, finSup01 } from '../spec/screens'
import type { ButtonSpec, FieldSetSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 보완 요청 확인·재제출(FIN-SUP-01).
//
// 이 화면이 처음인 것은 **명세가 칸을 모른다**는 것이다. 무엇을 다시 받아야 하는지는
// 그 품목의 구매 유형이 정하고(사람이 확인했다), 칸 목록을 명세가 들고 있으면 유형이
// 하나 늘 때마다 명세가 틀린다. 그래서 명세는 여기에 묶음이 있다는 것과 그 모양을
// 어디서 읽는지만 말한다.
//
// 보완 품목도 여럿일 수 있다. 되풀이되는 것은 자리가 아니라 틀이라, 명세는 첫 항목의
// 노드만 등록한다(FIN-REQ-01의 품목과 같은 규칙).

const SCREEN = 'FIN-SUP-01'

const NODE = {
  notice: '30:1178',
  items: '30:1197',
  itemHeading: '30:1198',
  itemReason: '30:1204',
  itemExisting: '30:1209',
  corrections: '30:1239',
  attachments: '30:1264',
  saveDraft: '30:1291',
  resubmit: '30:1293',
} as const

const ASSET = {
  notice: '30:1179',
  attachment: '30:1270',
} as const

const BREADCRUMB_SEPARATORS = ['30:1144', '30:1149', '30:1154', '30:1159', '30:1164', '30:1169']

interface FINSUP01ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리. 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  /** 명세가 onSuccess.scopeEvent를 말하면 보낸 뒤 그 스코프를 비운다. */
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

// 값은 '항목.묶음.칸' 꼴로 담는다. 칸의 이름은 데이터가 주므로 화면이 미리 알 수 없고,
// 품목이 여럿이면 같은 이름의 칸이 여럿 생긴다.
function valueKey(itemId: string, setKey: string, fieldKey: string): string {
  return `${itemId}.${setKey}.${fieldKey}`
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-SUP-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function FINSUP01Screen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: FINSUP01ScreenProps) {
  // 값은 **화면 안이 아니라 스코프에 산다**(명세: stateScopeKey, 수명 flow).
  // 한동안 이 화면은 useState에만 담았고, 그래서 뒤로 갔다 오면 쓰던 것이
  // 사라졌다 - 명세가 말한 수명이 거짓이었다(2026-08-27 감사).
  const values = draft.values
  const setValues = (update: (before: Record<string, string | null>) => Record<string, string | null>) => {
    onChangeDraft({ values: update(draft.values), labels: draft.labels })
  }
  const [blocked, setBlocked] = useState(false)
  const submitAction = useSubmitAction()

  const missing = (finSup01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={finSup01.screenId}
        activeNavigationScreenId={finSup01.activeNavigationScreenId}
        eyebrow={finSup01.meta?.eyebrow}
        title={finSup01.meta?.title ?? finSup01.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const breadcrumb = finSup01.breadcrumb
  const breadcrumbRow =
    breadcrumb?.dataSourceKey === undefined
      ? null
      : readObjectSource(
          breadcrumb.dataSourceKey,
          resolveParams(breadcrumb.params, { screenParams }),
        )

  const notice = elementByNodeId(finSup01, NODE.notice).spec as SummarySpec
  const noticeRow = readObjectSource(
    notice.dataSourceKey ?? '',
    resolveParams(notice.params, { screenParams }),
  )

  const list = elementByNodeId(finSup01, NODE.items).spec as ItemListSpec
  const items = readListSource(list.dataSourceKey, resolveParams(list.params, { screenParams }))
  const listSource = findDataSource(list.dataSourceKey)

  const fieldOf = (nodeId: string) => {
    const found = (list.itemFields ?? []).find((element) => element.source.nodeId === nodeId)
    if (found === undefined) {
      throw new Error(`FIN-SUP-01의 항목에 노드 ${nodeId}가 등록되지 않았습니다.`)
    }
    return found.spec
  }
  const heading = fieldOf(NODE.itemHeading) as SummarySpec
  const reason = fieldOf(NODE.itemReason) as SummarySpec
  const existing = fieldOf(NODE.itemExisting) as SummarySpec
  const corrections = fieldOf(NODE.corrections) as FieldSetSpec
  const attachments = fieldOf(NODE.attachments) as FieldSetSpec

  const fieldsOf = (set: FieldSetSpec, row: DataRow) =>
    readListSource(set.dataSourceKey, resolveParams(set.params, { row }))

  // 채워야 할 칸이 무엇인지도 데이터가 안다. 그래서 '다 채웠는가'를 화면이 미리
  // 셀 수 없고, 그릴 때 모은 것으로 판정한다.
  const requiredKeys: string[] = []
  for (const row of items) {
    for (const set of [corrections, attachments]) {
      if (set.required !== true) continue
      for (const field of fieldsOf(set, row)) {
        requiredKeys.push(valueKey(scalar(row, 'id'), set.fieldKey, scalar(field, 'key')))
      }
    }
  }
  const firstMissing = requiredKeys.find((key) => (values[key] ?? '') === '')

  const buttonAt = (nodeId: string) => elementByNodeId(finSup01, nodeId).spec as ButtonSpec
  const saveDraft = buttonAt(NODE.saveDraft)
  const resubmit = buttonAt(NODE.resubmit)

  function press(spec: ButtonSpec) {
    return () => {
      if (spec.action.type !== 'submit') return
      // 막는 조건이 있는 버튼만 막는다. 임시 저장은 다 채우지 않아도 보관한다 -
      // 아직 넘기지 않았다는 것이 임시 저장의 뜻이다.
      if (spec.action.executeWhen !== undefined && firstMissing !== undefined) {
        setBlocked(true)
        return
      }
      setBlocked(false)
      void submitAction.run(spec.action, {
        payload: values,
        onNavigate,
        // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
        // 어디 있는지만 알려 준다.
        paramSources: { screenParams },
        onScopeEvent,
      })
    }
  }

  return (
    <AppShell
      screenId={finSup01.screenId}
      activeNavigationScreenId={finSup01.activeNavigationScreenId}
      eyebrow={finSup01.meta?.eyebrow}
      title={finSup01.meta?.title ?? finSup01.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : String(breadcrumbRow?.[item.field] ?? ''),
            )}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-6">
        <section
          data-node-id={NODE.notice}
          className="flex gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.notice} className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-yellow-800">{notice.title}</span>
            <span className="block pt-1 text-xs font-normal text-yellow-700">
              {notice.description}
            </span>
            <span className="flex flex-wrap gap-4 pt-2">
              {(notice.items ?? []).map((item) => (
                <span key={item.field} className="text-xs font-semibold text-yellow-700">
                  {scalar(noticeRow, item.field ?? '')}
                </span>
              ))}
            </span>
          </span>
        </section>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{listSource.messages.empty}</p>
        ) : (
          items.map((row, index) => {
            const itemId = scalar(row, 'id')
            const first = index === 0
            return (
              <section
                key={itemId}
                data-node-id={first ? NODE.items : undefined}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <span data-node-id={first ? NODE.itemHeading : undefined}
                  className="block border-b border-gray-100 pb-4"
                >
                  <span className="block text-sm font-bold text-gray-800">
                    {scalar(row, heading.titleField ?? '')}
                  </span>
                  <span className="block pt-1 text-xs font-normal text-gray-500">
                    {scalar(row, heading.descriptionField ?? '')}
                  </span>
                </span>

                <span
                  data-node-id={first ? NODE.itemReason : undefined}
                  className="mt-4 block rounded-lg border border-yellow-100 bg-yellow-50 p-4"
                >
                  <span className="block text-xs font-bold text-yellow-700">{reason.title}</span>
                  {(reason.items ?? []).map((item) => (
                    <span key={item.field} className="block pt-1 text-xs font-normal text-yellow-800">
                      {scalar(row, item.field ?? '')}
                    </span>
                  ))}
                </span>

                <span data-node-id={first ? NODE.itemExisting : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">{existing.title}</span>
                  <span className="grid grid-cols-5 gap-3 pt-2">
                    {(existing.items ?? []).map((item) => (
                      <span key={item.field} className="rounded-lg bg-gray-50 p-3">
                        <span className="block text-xs font-normal text-gray-400">
                          {item.label}
                        </span>
                        <span className="block pt-0.5 text-xs font-semibold text-gray-700">
                          {scalar(row, item.field ?? '')}
                        </span>
                      </span>
                    ))}
                  </span>
                </span>

                {/* 칸이 무엇인지 명세는 모른다. 그리는 순서도 데이터가 준 순서다. */}
                <span data-node-id={first ? NODE.corrections : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">
                    {corrections.label}
                  </span>
                  <span className="grid grid-cols-2 gap-3 pt-2">
                    {fieldsOf(corrections, row).map((field) => {
                      const key = valueKey(itemId, corrections.fieldKey, scalar(field, 'key'))
                      return (
                        <label key={key} className="block">
                          <span className="block pb-1 text-xs font-bold text-gray-600">
                            {scalar(field, 'label')}
                          </span>
                          <input
                            type="text"
                            value={values[key] ?? ''}
                            placeholder={scalar(field, 'placeholder')}
                            aria-invalid={blocked && (values[key] ?? '') === ''}
                            onChange={(event) =>
                              setValues((before) => ({ ...before, [key]: event.target.value }))
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                          />
                        </label>
                      )
                    })}
                  </span>
                </span>

                <span data-node-id={first ? NODE.attachments : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">
                    {attachments.label}
                  </span>
                  <span className="grid grid-cols-3 gap-3 pt-2">
                    {fieldsOf(attachments, row).map((field) => {
                      const key = valueKey(itemId, attachments.fieldKey, scalar(field, 'key'))
                      const chosen = values[key] ?? ''
                      return (
                        <button
                          key={key}
                          type="button"
                          // 파일을 실제로 고르는 일은 아직 그려지지 않았다. 무엇을 넣는
                          // 자리인지가 명세의 몫이고, 어떻게 넣는지는 디자인이 말한다.
                          onClick={() =>
                            setValues((before) => ({ ...before, [key]: scalar(field, 'label') }))
                          }
                          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                        >
                          <FigmaAsset
                            screenId={SCREEN}
                            nodeId={ASSET.attachment}
                            className="size-4"
                          />
                          <span className="text-xs font-semibold text-gray-400">
                            {scalar(field, 'label')}
                          </span>
                          <span className="text-xs font-normal text-gray-300">
                            {chosen === '' ? scalar(field, 'placeholder') : chosen}
                          </span>
                        </button>
                      )
                    })}
                  </span>
                </span>
              </section>
            )
          })
        )}

        {submitAction.submittingMessage === null ? null : (
          <p role="status" className="text-sm text-gray-600">
            {submitAction.submittingMessage}
          </p>
        )}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-sm text-red-700">
            {submitAction.errorMessage}
          </p>
        )}
        {!blocked || firstMissing === undefined ? null : (
          <p role="alert" className="text-sm text-red-700">
            아직 채우지 않은 칸이 있습니다.
          </p>
        )}

        <div className="flex justify-end gap-2">
          {[saveDraft, resubmit].map((spec, index) => (
            <button
              key={spec.label}
              type="button"
              data-node-id={index === 0 ? NODE.saveDraft : NODE.resubmit}
              onClick={press(spec)}
              className={
                spec.emphasis === 'primary'
                  ? 'rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700'
                  : 'rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50'
              }
            >
              {spec.label}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
