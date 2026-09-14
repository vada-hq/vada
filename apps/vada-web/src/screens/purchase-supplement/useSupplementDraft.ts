import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, finSup01 } from '../../spec/screens'
import type { ButtonSpec, FieldSetSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { NODE, scalar, valueKey } from './spec'

export interface SupplementDraftProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useSupplementDraft({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: SupplementDraftProps) {
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
    return { ready: false as const, screen: finSup01, missing }
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
    const found = (list.itemFields ?? []).find((element) => element.source?.nodeId === nodeId)
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
        // 어느 요청의 보완인지를 함께 싣는다 — 계약의 자리에 인자가 없다(FIN-EVID-01의
        // '처리 완료'가 requestId를 몸통에 싣는 것과 같은 길).
        payload: { ...values, requestId: screenParams.requestId ?? '' },
        onNavigate,
        // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
        // 어디 있는지만 알려 준다.
        paramSources: { screenParams },
        onScopeEvent,
      })
    }
  }


  return {
    ready: true as const,
    screen: finSup01,
    breadcrumb,
    breadcrumbRow,
    notice,
    noticeRow,
    items,
    listSource,
    heading,
    reason,
    existing,
    corrections,
    attachments,
    fieldsOf,
    values,
    setValues,
    blocked,
    firstMissing,
    submitAction,
    saveDraft,
    resubmit,
    press,
  }
}

export type SupplementDraftModel = Extract<
  ReturnType<typeof useSupplementDraft>,
  { ready: true }
>
