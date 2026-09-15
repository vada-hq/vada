import { useState } from 'react'
import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow, DataValue } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, nodeIdOf } from '../../spec/screens'
import { finReq02 } from '../../spec/screen-specs/finReq02'
import type { ElementSpec } from '../../spec/types'

function specOf<T extends ElementSpec['type']>(
  type: T,
  index = 0,
): Extract<ElementSpec, { type: T }> {
  const found = finReq02.elements.filter((element) => element.spec.type === type)[index]?.spec
  if (found === undefined || found.type !== type) {
    throw new Error(`FIN-REQ-02에 ${type} 요소 ${index + 1}번째가 없습니다.`)
  }
  return found as Extract<ElementSpec, { type: T }>
}

function scalar(row: DataRow, field: string): string {
  const value: DataValue | undefined = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-REQ-02의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

const stepsSpec = specOf('steps')
const summarySpec = specOf('summary')
const resultListSpec = specOf('itemList', 0)
const historySpec = specOf('itemList', 1)
const pendingButton = specOf('button')

export function useFinanceRequestDetail(
  screenParams: Record<string, string>,
  onNavigate: (screenId: string, params?: Record<string, string>) => void,
) {
  const [notice, setNotice] = useState<string | null>(null)
  const title = drawnTitleOf(finReq02, screenParams)
  const missingParam = (finReq02.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missingParam !== undefined) {
    return { ready: false as const, title, message: missingParam.missingNote }
  }

  const breadcrumb = finReq02.breadcrumb
  const breadcrumbRow = breadcrumb?.dataSourceKey
    ? readObjectSourceOrNull(
        breadcrumb.dataSourceKey,
        resolveParams(breadcrumb.params, { screenParams }),
      )
    : null
  const stepDetail = readObjectSourceOrNull(
    stepsSpec.dataSourceKey,
    resolveParams(stepsSpec.params, { screenParams }),
  )
  const summaryDetail = summarySpec.dataSourceKey
    ? readObjectSourceOrNull(
        summarySpec.dataSourceKey,
        resolveParams(summarySpec.params, { screenParams }),
      )
    : null

  if (stepDetail === null || summaryDetail === null || summarySpec.dataSourceKey === undefined) {
    return {
      ready: false as const,
      title,
      message: findDataSource(summarySpec.dataSourceKey ?? stepsSpec.dataSourceKey).messages.empty,
    }
  }
  if (
    summarySpec.eyebrowField === undefined ||
    summarySpec.titleField === undefined ||
    summarySpec.status === undefined ||
    summarySpec.items === undefined
  ) {
    throw new Error('FIN-REQ-02의 상세 요약에 번호·제목·상태·항목이 모두 필요합니다.')
  }
  const summaryItems = summarySpec.items.map((item) => {
    if (item.label === undefined || item.field === undefined) {
      throw new Error('FIN-REQ-02의 상세 요약 항목에는 label과 field가 필요합니다.')
    }
    return { label: item.label, value: scalar(summaryDetail, item.field) }
  })
  if (resultListSpec.title === undefined || resultListSpec.columns === undefined) {
    throw new Error('FIN-REQ-02의 품목 처리 결과에는 제목과 열이 필요합니다.')
  }
  if (historySpec.title === undefined) {
    throw new Error('FIN-REQ-02의 처리 기록에는 제목이 필요합니다.')
  }

  const resultRows = readListSource(
    resultListSpec.dataSourceKey,
    resolveParams(resultListSpec.params, { screenParams }),
  )
  const historyRows = readListSource(
    historySpec.dataSourceKey,
    resolveParams(historySpec.params, { screenParams }),
  )
  const [historyTitleColumn, historyNoteColumn] = historySpec.columns ?? []
  const historyTitleField = historyTitleColumn?.fields?.[0]
  const historyNoteField = historyNoteColumn?.fields?.[0]
  if (historyTitleField === undefined || historyNoteField === undefined) {
    throw new Error('처리 기록에 그려지는 조각이 명세에 없습니다.')
  }

  function pressSupplement() {
    if (pendingButton.action.type === 'pending') {
      setNotice(pendingButton.action.note)
    } else if (pendingButton.action.type === 'navigate') {
      onNavigate(
        pendingButton.action.targetScreenId,
        resolveParams(pendingButton.action.params, { screenParams }),
      )
    }
  }

  return {
    ready: true as const,
    title,
    notice,
    breadcrumb,
    breadcrumbItems: breadcrumb?.items.map((item) =>
      item.field === undefined
        ? (item.value ?? '')
        : scalar(breadcrumbRow ?? summaryDetail, item.field),
    ),
    stepsSpec,
    stepNodeId: nodeIdOf(finReq02, stepsSpec),
    currentStep: scalar(stepDetail, stepsSpec.currentField!),
    summarySpec,
    summaryNodeId: nodeIdOf(finReq02, summarySpec),
    summary: {
      eyebrow: scalar(summaryDetail, summarySpec.eyebrowField),
      status: {
        label: scalar(summaryDetail, summarySpec.status[0].field),
        tone: scalar(summaryDetail, summarySpec.status[0].toneField),
      },
      title: scalar(summaryDetail, summarySpec.titleField),
      items: summaryItems,
    },
    resultListSpec,
    resultListTitle: resultListSpec.title,
    resultListColumns: resultListSpec.columns,
    resultNodeId: nodeIdOf(finReq02, resultListSpec),
    resultRows,
    resultEmptyMessage: findDataSource(resultListSpec.dataSourceKey).messages.empty,
    historySpec,
    historyTitle: historySpec.title,
    historyNodeId: nodeIdOf(finReq02, historySpec),
    historyRows,
    historyTitleField,
    historyNoteField,
    historyEmptyMessage: findDataSource(historySpec.dataSourceKey).messages.empty,
    pendingButton,
    pendingButtonNodeId: nodeIdOf(finReq02, pendingButton),
    pressSupplement,
  }
}

export type ReadyFinanceRequestDetail = Extract<
  ReturnType<typeof useFinanceRequestDetail>,
  { ready: true }
>
