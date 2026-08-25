import { useState } from 'react'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { CautionButton } from '../components/CautionButton'
import { DataTable } from '../components/DataTable'
import { ProgressSteps } from '../components/ProgressSteps'
import { SummaryCard } from '../components/SummaryCard'
import {
  findDataSource,
  readListSource,
  readObjectSourceOrNull,
} from '../data-sources/catalog'
import type { DataRow, DataValue } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, finReq02, nodeIdOf } from '../spec/screens'
import type { ElementSpec } from '../spec/types'

interface FINREQ02ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

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

// 경로 조각 사이의 화살표. 명세는 조각이 무엇인지만 말하고, 그 사이에 어떤
// 그림이 오는지는 design이 갖는다.
const BREADCRUMB_SEPARATORS = ['30:900', '30:905', '30:910', '30:915', '30:920']

const stepsSpec = specOf('steps')
const summarySpec = specOf('summary')
const resultListSpec = specOf('itemList', 0)
const historySpec = specOf('itemList', 1)
const pendingButton = specOf('button')

export function FINREQ02Screen({ screenParams, onNavigate }: FINREQ02ScreenProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const title = drawnTitleOf(finReq02, screenParams)
  const meta = finReq02.meta
  if (meta === undefined) {
    throw new Error('FIN-REQ-02의 화면 카피가 없습니다.')
  }

  const missingParam = (finReq02.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missingParam !== undefined) {
    return (
      <AppShell
        screenId={finReq02.screenId}
        activeNavigationScreenId="OPS-00"
        title={title}
        eyebrow={meta.eyebrow}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert">{missingParam.missingNote}</p>
      </AppShell>
    )
  }

  // 경로의 조각 중 데이터에서 오는 것이 있으면 그 출처를 읽는다. 요약과 같은
  // 출처인 것이 보통이지만 같다고 가정하지 않는다 — 명세가 따로 가리킨다.
  const breadcrumb = finReq02.breadcrumb
  const breadcrumbRow =
    breadcrumb?.dataSourceKey === undefined
      ? null
      : readObjectSourceOrNull(
          breadcrumb.dataSourceKey,
          resolveParams(breadcrumb.params, { screenParams }),
        )

  const stepParams = resolveParams(stepsSpec.params, { screenParams })
  const summaryParams = resolveParams(summarySpec.params, { screenParams })
  const stepDetail = readObjectSourceOrNull(stepsSpec.dataSourceKey, stepParams)
  const summaryDetail = summarySpec.dataSourceKey
    ? readObjectSourceOrNull(summarySpec.dataSourceKey, summaryParams)
    : null

  if (stepDetail === null || summaryDetail === null || summarySpec.dataSourceKey === undefined) {
    const source = findDataSource(summarySpec.dataSourceKey ?? stepsSpec.dataSourceKey)
    return (
      <AppShell
        screenId={finReq02.screenId}
        activeNavigationScreenId="OPS-00"
        title={title}
        eyebrow={meta.eyebrow}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert">{source.messages.empty}</p>
      </AppShell>
    )
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
  const resultSource = findDataSource(resultListSpec.dataSourceKey)
  const historySource = findDataSource(historySpec.dataSourceKey)

  // 어느 조각이 주 문구이고 어느 것이 보조인지는 명세가 말한다. 출처의 조각
  // 이름을 화면이 뒤져 고르면 그것은 명세가 아니라 짐작이다.
  const [historyTitleColumn, historyNoteColumn] = historySpec.columns ?? []
  const historyTitleField = historyTitleColumn?.fields[0]
  const historyNoteField = historyNoteColumn?.fields[0]
  if (historyTitleField === undefined || historyNoteField === undefined) {
    throw new Error('처리 기록에 그려지는 조각이 명세에 없습니다.')
  }

  function showPendingNote() {
    if (pendingButton.action.type !== 'pending') {
      throw new Error('보완 내용 확인은 아직 정해지지 않은 동작이어야 합니다.')
    }
    setNotice(pendingButton.action.note)
  }

  return (
    <AppShell
      screenId={finReq02.screenId}
      activeNavigationScreenId="OPS-00"
      title={title}
      eyebrow={meta.eyebrow}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={finReq02.screenId}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalar(breadcrumbRow ?? summaryDetail, item.field),
            )}
          />
        )
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        <ProgressSteps
          nodeId={nodeIdOf(finReq02, stepsSpec)}
          items={stepsSpec.items}
          currentKey={scalar(stepDetail, stepsSpec.currentField)}
          completedIconNodeId="30:932"
        />

        <SummaryCard
          nodeId={nodeIdOf(finReq02, summarySpec)}
          variant="detail"
          eyebrow={scalar(summaryDetail, summarySpec.eyebrowField)}
          status={{
            label: scalar(summaryDetail, summarySpec.status.field),
            tone: scalar(summaryDetail, summarySpec.status.toneField),
          }}
          title={scalar(summaryDetail, summarySpec.titleField)}
          items={summaryItems}
        />

        <DataTable
          nodeId={nodeIdOf(finReq02, resultListSpec)}
          title={resultListSpec.title}
          columns={resultListSpec.columns}
          rows={resultRows}
          emptyMessage={resultSource.messages.empty}
          columnWidths={['18%', '19%', '11%', '18%', '34%']}
          fieldPresentation={{
            name: 'title',
            quantityNote: 'muted',
            amountNote: 'body',
            result: 'status',
            note: 'muted',
          }}
          headerAction={
            <CautionButton
              nodeId={nodeIdOf(finReq02, pendingButton)}
              label={pendingButton.label}
              disabled={pendingButton.initiallyDisabled}
              onClick={showPendingNote}
            />
          }
        />

        {notice === null ? null : (
          <p role="alert" className="text-sm">
            {notice}
          </p>
        )}

        <ActivityTimeline
          nodeId={nodeIdOf(finReq02, historySpec)}
          title={historySpec.title}
          rows={historyRows}
          titleField={historyTitleField}
          noteField={historyNoteField}
          emptyMessage={historySource.messages.empty}
        />
      </div>
    </AppShell>
  )
}
