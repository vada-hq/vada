import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { finEvid01 } from '../../spec/screen-specs/finEvid01'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'
import { columnField, evidenceScalar as scalar } from './values'

export interface FinanceEvidenceProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useFinanceEvidence({ screenParams, onNavigate }: FinanceEvidenceProps) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const missing = (finEvid01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: finEvid01,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const head = elementByNodeId(finEvid01, NODE.head).spec as SummarySpec
  const summaryRow = readObjectSource(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )
  const list = elementByNodeId(finEvid01, NODE.payments).spec as ItemListSpec
  const payments = readListSource(
    list.dataSourceKey,
    resolveParams(list.params, { screenParams }),
  )
  const itemFieldAt = (nodeId: string) => {
    const found = (list.itemFields ?? []).find((element) => element.source?.nodeId === nodeId)
    if (found === undefined) {
      throw new Error(`FIN-EVID-01의 결제에 노드 ${nodeId}가 등록되지 않았습니다.`)
    }
    return found.spec
  }
  const vendor = itemFieldAt(NODE.vendor) as SummarySpec
  const amount = itemFieldAt(NODE.amount) as SummarySpec
  const itemsList = itemFieldAt(NODE.items) as ItemListSpec
  const documentsList = itemFieldAt(NODE.documents) as ItemListSpec
  const addFile = itemFieldAt(NODE.addFile) as ButtonSpec
  const buttonAt = (nodeId: string) => elementByNodeId(finEvid01, nodeId).spec as ButtonSpec
  const save = buttonAt(NODE.save)
  const complete = buttonAt(NODE.complete)
  const gate = complete.action.type === 'submit' ? complete.action.executeWhen : undefined
  const blockedNote =
    gate?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(gate.dataSourceKey, resolveParams(gate.params, { screenParams })),
          gate.blockedNoteField,
        )
      : ''

  function pressPending(spec: ButtonSpec) {
    return () => {
      if (spec.action.type === 'pending') setNote(spec.action.note)
    }
  }

  function pressComplete() {
    if (complete.action.type !== 'submit') return
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    setNote(null)
    void submitAction.run(complete.action, {
      payload: { requestId: screenParams.requestId ?? '' },
      onNavigate,
      paramSources: { screenParams },
    })
  }

  const documentTone = documentsList.columns?.[1]?.toneField
  if (documentTone === undefined) {
    throw new Error('FIN-EVID-01의 증빙 서류 상태에 색 이름 조각이 없습니다.')
  }
  const breadcrumbItems = finEvid01.breadcrumb?.items.map((item) =>
    item.field === undefined ? (item.value ?? '') : scalar(summaryRow, item.field),
  )

  return {
    ready: true as const,
    screen: finEvid01,
    screenParams,
    onNavigate,
    note,
    submitAction,
    head,
    summaryRow,
    list,
    payments,
    emptyMessage: findDataSource(list.dataSourceKey).messages.empty,
    vendor,
    amount,
    itemsList,
    documentsList,
    addFile,
    save,
    complete,
    pressPending,
    pressComplete,
    itemName: columnField(itemsList, 0),
    documentLabel: columnField(documentsList, 0),
    documentStatus: columnField(documentsList, 1),
    documentTone,
    breadcrumbItems,
  }
}

export type FinanceEvidenceModel = Extract<
  ReturnType<typeof useFinanceEvidence>,
  { ready: true }
>
