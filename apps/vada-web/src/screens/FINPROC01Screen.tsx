import { useState, type ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { GroupedDataTable } from '../components/GroupedDataTable'
import { NoteBox } from '../components/NoteBox'
import { PrimaryButton } from '../components/PrimaryButton'
import { SummaryCard } from '../components/SummaryCard'
import {
  findDataSource,
  readListSource,
  readObjectSourceOrNull,
  type DataRow,
  type DataValue,
} from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { finProc01 } from '../spec/screens'

interface FINPROC01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

const summaryElement = finProc01.elements.find((element) => element.spec.type === 'summary')
const ordersElement = finProc01.elements.find((element) => element.spec.type === 'itemList')
const buttonElement = finProc01.elements.find((element) => element.spec.type === 'button')

if (summaryElement?.spec.type !== 'summary') {
  throw new Error('FIN-PROC-01에 summary 요소가 없습니다.')
}
if (ordersElement?.spec.type !== 'itemList') {
  throw new Error('FIN-PROC-01에 itemList 요소가 없습니다.')
}
if (buttonElement?.spec.type !== 'button') {
  throw new Error('FIN-PROC-01에 button 요소가 없습니다.')
}

const summarySpec = summaryElement.spec
const ordersSpec = ordersElement.spec
const buttonSpec = buttonElement.spec
const summaryNodeId = summaryElement.source.nodeId
const ordersNodeId = ordersElement.source.nodeId
const buttonNodeId = buttonElement.source.nodeId

function scalar(value: DataValue | undefined, field: string): string {
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-PROC-01의 '${field}' 조각은 한 줄 값이어야 합니다.`)
  }
  return String(value)
}

function fieldValue(row: DataRow, field: string | undefined, place: string): string {
  if (field === undefined) {
    throw new Error(`FIN-PROC-01의 ${place}에 데이터 조각이 지정되지 않았습니다.`)
  }
  return scalar(row[field], field)
}

function ScreenFrame({
  breadcrumb,
  onNavigate,
  children,
}: {
  breadcrumb?: ReactNode
  onNavigate: FINPROC01ScreenProps['onNavigate']
  children: ReactNode
}) {
  if (finProc01.meta === undefined) {
    throw new Error('FIN-PROC-01에 화면 제목이 없습니다.')
  }

  return (
    <AppShell
      screenId={finProc01.screenId}
      // 최상위 메뉴 소속을 담는 스키마 자리가 없어 design에서 켜진 '운영'을 따른다.
      activeNavigationScreenId="OPS-00"
      eyebrow={finProc01.meta.eyebrow}
      title={finProc01.meta.title}
      description={finProc01.meta.description}
      footerNote={finProc01.meta.footerNote}
      breadcrumb={breadcrumb}
      onNavigate={onNavigate}
    >
      {children}
    </AppShell>
  )
}

export function FINPROC01Screen({ screenParams, onNavigate }: FINPROC01ScreenProps) {
  const [pendingNote, setPendingNote] = useState<string | null>(null)
  const requestParam = finProc01.params?.[0]
  if (requestParam === undefined) {
    throw new Error('FIN-PROC-01에 요청을 가리킬 화면 인자가 없습니다.')
  }
  const requestId = screenParams[requestParam.key]

  if (!requestId) {
    if (requestParam.missingNote === undefined) {
      throw new Error(`FIN-PROC-01의 '${requestParam.key}' 인자에 missingNote가 없습니다.`)
    }
    return (
      <ScreenFrame onNavigate={onNavigate}>
        <div role="alert" className="mx-auto max-w-[960px]">
          <NoteBox text={requestParam.missingNote} />
        </div>
      </ScreenFrame>
    )
  }

  if (summarySpec.dataSourceKey === undefined) {
    throw new Error('FIN-PROC-01 summary에 dataSourceKey가 없습니다.')
  }
  const summaryParams = resolveParams(summarySpec.params, { screenParams })
  const summaryRow = readObjectSourceOrNull(summarySpec.dataSourceKey, summaryParams)
  if (summaryRow === null) {
    return (
      <ScreenFrame onNavigate={onNavigate}>
        <div role="alert" className="mx-auto max-w-[960px]">
          <NoteBox text={findDataSource(summarySpec.dataSourceKey).messages.empty} />
        </div>
      </ScreenFrame>
    )
  }

  const breadcrumbSpec = finProc01.breadcrumb
  if (breadcrumbSpec === undefined || breadcrumbSpec.dataSourceKey === undefined) {
    throw new Error('FIN-PROC-01에 데이터 기반 breadcrumb가 없습니다.')
  }
  const breadcrumbRow = readObjectSourceOrNull(
    breadcrumbSpec.dataSourceKey,
    resolveParams(breadcrumbSpec.params, { screenParams }),
  )
  if (breadcrumbRow === null) {
    throw new Error('FIN-PROC-01의 breadcrumb 데이터를 찾지 못했습니다.')
  }
  const breadcrumbItems = breadcrumbSpec.items.map((item) => {
    if (item.value !== undefined) return item.value
    return fieldValue(breadcrumbRow, item.field, 'breadcrumb')
  })

  if (summarySpec.items === undefined || summarySpec.status === undefined) {
    throw new Error('FIN-PROC-01 summary의 항목 또는 상태가 없습니다.')
  }
  const summaryItems = summarySpec.items.map((item) => {
    if (item.label === undefined) {
      throw new Error('FIN-PROC-01 summary 항목에 그릴 label이 없습니다.')
    }
    const value = item.value ?? fieldValue(summaryRow, item.field, `summary '${item.label}'`)
    return { label: item.label, value }
  })

  if (ordersSpec.columns === undefined || ordersSpec.group === undefined) {
    throw new Error('FIN-PROC-01 itemList에 columns와 group이 필요합니다.')
  }
  const orders = readListSource(
    ordersSpec.dataSourceKey,
    resolveParams(ordersSpec.params, { screenParams }),
  )

  if (buttonSpec.action.type !== 'pending') {
    throw new Error('FIN-PROC-01의 다음 단계 버튼은 pending 동작이어야 합니다.')
  }
  const nextStepNote = buttonSpec.action.note

  return (
    <ScreenFrame
      onNavigate={onNavigate}
      breadcrumb={
        <Breadcrumbs
          nodeId={breadcrumbSpec.source}
          screenId={finProc01.screenId}
          items={breadcrumbItems}
          separatorNodeIds={['30:1636', '30:1641', '30:1646', '30:1651']}
        />
      }
    >
      <div className="mx-auto flex max-w-[960px] flex-col gap-6">
        <SummaryCard
          nodeId={summaryNodeId}
          eyebrow={fieldValue(summaryRow, summarySpec.eyebrowField, 'summary 소제목')}
          status={{
            label: fieldValue(summaryRow, summarySpec.status.field, 'summary 상태'),
            tone: fieldValue(summaryRow, summarySpec.status.toneField, 'summary 상태 톤'),
          }}
          title={fieldValue(summaryRow, summarySpec.titleField, 'summary 제목')}
          description={fieldValue(summaryRow, summarySpec.descriptionField, 'summary 설명')}
          items={summaryItems}
          variant="detail"
        />

        <GroupedDataTable
          firstGroupNodeId={ordersNodeId}
          columns={ordersSpec.columns}
          // 열의 글·딱지 표현은 동작 명세가 아니라 figma.design.json이 정한다.
          columnPresentations={['title', 'body', 'amount', 'chip', 'body', 'toneText']}
          group={ordersSpec.group}
          groups={orders}
          emptyMessage={findDataSource(ordersSpec.dataSourceKey).messages.empty}
        />

        <div className="flex flex-col items-end gap-3">
          <PrimaryButton
            nodeId={buttonNodeId}
            label={buttonSpec.label}
            onClick={() => setPendingNote(nextStepNote)}
            fullWidth={false}
            trailingArrow={false}
            strong
            roomy
            disabled={buttonSpec.initiallyDisabled}
          />
          {pendingNote === null ? null : (
            <div role="alert" className="max-w-xl">
              <NoteBox text={pendingNote} />
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  )
}
