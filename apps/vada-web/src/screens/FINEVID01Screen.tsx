import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { MUTED_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { useSubmitAction } from '../spec/useSubmitAction'
import { resolveParams } from '../spec/params'
import { elementByNodeId, finEvid01 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 결제·증빙 정리(FIN-EVID-01). 재정 갈래의 마지막 단계다.
//
// 이 화면이 처음인 것 둘.
//
// **묶음 안에 목록이 둘이다.** 결제 하나는 연결된 품목과 증빙 서류를 함께 갖는데,
// 둘 다 그 결제와 함께 이미 와 있다. 따로 조회하지 않는다 — 그 목록은 그 결제의
// 일부이지 따로 있는 것이 아니다(itemList.itemsField).
//
// **끝낼 수 있는지를 서버가 정한다.** 무엇이 '증빙이 다 모인 것'인지는 조직의 재정
// 규칙이라 화면이 셀 수 없다. 영수증만 있으면 되는 결제도 있고 세금계산서까지
// 있어야 하는 결제도 있다. 화면이 그것을 세면 재정 규칙이 화면에 적히게 된다
// (금액을 서버가 셈하는 것과 같은 이유다).

const SCREEN = 'FIN-EVID-01'

const NODE = {
  head: '30:1865',
  payments: '30:1887',
  vendor: '30:1889',
  amount: '30:1894',
  items: '30:1899',
  documents: '30:1908',
  addFile: '30:1922',
  save: '30:2012',
  complete: '30:2014',
} as const

const ASSET = { addFile: '30:1924' } as const

const BREADCRUMB_SEPARATORS = ['30:1841', '30:1846', '30:1851', '30:1856']

// 실결제 합계만 도드라진다. 그것이 승인 금액과 다를 수 있다는 것이 이 단계의
// 물음이기 때문이다 — 데이터가 정할 일이 아니라 화면이 무엇을 앞세울지 정한다.
const TILE_TEXT: Record<string, string> = { paidAmountNote: 'text-blue-700' }

interface FINEVID01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-EVID-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 안쪽 목록은 조회하지 않는다. 바깥 항목의 이 조각이 곧 항목들이다.
function nestedRows(row: DataRow, spec: ItemListSpec): DataRow[] {
  if (spec.itemsField === undefined) {
    throw new Error('FIN-EVID-01의 안쪽 목록에 itemsField가 없습니다.')
  }
  const value = row[spec.itemsField]
  if (!Array.isArray(value)) {
    throw new Error(`FIN-EVID-01의 조각 '${spec.itemsField}'는 항목들이어야 합니다.`)
  }
  return value
}

function columnField(spec: ItemListSpec, at: number): string {
  const field = spec.columns?.[at]?.fields?.[0]
  if (field === undefined) {
    throw new Error(`FIN-EVID-01의 안쪽 목록에 ${at + 1}번째 열이 없습니다.`)
  }
  return field
}

export function FINEVID01Screen({ screenParams, onNavigate }: FINEVID01ScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const missing = (finEvid01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={finEvid01.screenId}
        activeNavigationScreenId={finEvid01.activeNavigationScreenId}
        eyebrow={finEvid01.meta?.eyebrow}
        title={finEvid01.meta?.title ?? finEvid01.screenId}
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

  const breadcrumb = finEvid01.breadcrumb
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
  const listSource = findDataSource(list.dataSourceKey)

  const itemFieldAt = (nodeId: string) => {
    const found = (list.itemFields ?? []).find((element) => element.source.nodeId === nodeId)
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

  // 막을지 말지는 서버가 말한다. 막은 이유가 있으면 막히고 그 글이 이유다.
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
      // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
      // 어디 있는지만 알려 준다.
      paramSources: { screenParams },
    })
  }

  const documentLabel = columnField(documentsList, 0)
  const documentStatus = columnField(documentsList, 1)
  const documentTone = documentsList.columns?.[1]?.toneField
  if (documentTone === undefined) {
    throw new Error('FIN-EVID-01의 증빙 서류 상태에 색 이름 조각이 없습니다.')
  }
  const itemName = columnField(itemsList, 0)

  return (
    <AppShell
      screenId={finEvid01.screenId}
      activeNavigationScreenId={finEvid01.activeNavigationScreenId}
      eyebrow={finEvid01.meta?.eyebrow}
      title={finEvid01.meta?.title ?? finEvid01.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(summaryRow, item.field),
            )}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-6">
        <section
          data-node-id={NODE.head}
          className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-xs font-normal text-gray-400">
                {scalar(summaryRow, head.eyebrowField ?? '')}
              </span>
              <span
                data-design-state
                data-design-rule="state-chip"
                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalar(summaryRow, head.status?.[0]?.toneField ?? '')] ?? NEUTRAL_CHIP
                }`}
              >
                {scalar(summaryRow, head.status?.[0]?.field ?? '')}
              </span>
            </span>
            <span className="block pt-1 text-lg font-bold text-gray-900">
              {scalar(summaryRow, head.titleField ?? '')}
            </span>
            <span className="block pt-1 text-xs font-normal text-gray-500">
              {scalar(summaryRow, head.descriptionField ?? '')}
            </span>
          </span>
          <span className="flex shrink-0 gap-6">
            {(head.items ?? []).map((item) => (
              <span key={item.field} className="text-right">
                <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
                <span
                  className={`block pt-1 text-lg font-bold ${
                    TILE_TEXT[item.field ?? ''] ?? 'text-gray-800'
                  }`}
                >
                  {scalar(summaryRow, item.field ?? '')}
                </span>
              </span>
            ))}
          </span>
        </section>

        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">{listSource.messages.empty}</p>
        ) : (
          payments.map((payment, index) => {
            // 되풀이되는 것은 자리가 아니라 틀이다. 명세는 첫 결제의 노드만 등록한다.
            const first = index === 0
            return (
              <section
                key={scalar(payment, 'id')}
                data-node-id={first ? NODE.payments : undefined}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <span className="flex items-start justify-between gap-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <span data-node-id={first ? NODE.vendor : undefined} className="min-w-0">
                    <span className="block text-sm font-bold text-gray-700">
                      {scalar(payment, vendor.titleField ?? '')}
                    </span>
                    <span className="block pt-1 text-xs font-normal text-gray-400">
                      {scalar(payment, vendor.descriptionField ?? '')}
                    </span>
                  </span>
                  <span
                    data-node-id={first ? NODE.amount : undefined}
                    className="shrink-0 text-right"
                  >
                    <span className="block text-xs font-normal text-gray-400">
                      {scalar(payment, amount.titleField ?? '')}
                    </span>
                    {/* 승인액과 같으면 차액 문구가 오지 않는다. 없는 것을 그리지 않는다. */}
                    {payment[amount.descriptionField ?? ''] === undefined ? null : (
                      <span className="block pt-1 text-xs font-normal text-red-500">
                        {scalar(payment, amount.descriptionField ?? '')}
                      </span>
                    )}
                  </span>
                </span>

                <span className="mt-4 block" data-node-id={first ? NODE.items : undefined}>
                  <span className="block text-xs font-bold text-gray-400">{itemsList.title}</span>
                  <span className="flex flex-wrap gap-2 pt-2">
                    {nestedRows(payment, itemsList).map((item) => (
                      <span
                        key={scalar(item, 'id')}
                        className={`inline-flex rounded px-2 py-1 text-xs font-medium ${MUTED_CHIP}`}
                      >
                        {scalar(item, itemName)}
                      </span>
                    ))}
                  </span>
                </span>

                <span className="mt-4 block" data-node-id={first ? NODE.documents : undefined}>
                  <span className="block text-xs font-bold text-gray-400">
                    {documentsList.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 pt-2">
                    {nestedRows(payment, documentsList).map((document) => (
                      <span key={scalar(document, 'id')} className="flex items-center gap-1.5">
                        <span className="text-xs font-normal text-gray-600">
                          {scalar(document, documentLabel)}
                        </span>
                        <span
                          data-design-rule="state-chip"
                          className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                            STATE_CHIP[scalar(document, documentTone)] ?? NEUTRAL_CHIP
                          }`}
                        >
                          {scalar(document, documentStatus)}
                        </span>
                      </span>
                    ))}
                    <button
                      type="button"
                      data-node-id={first ? NODE.addFile : undefined}
                      onClick={pressPending(addFile)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                    >
                      <FigmaAsset screenId={SCREEN} nodeId={ASSET.addFile} className="size-3" />
                      {addFile.label}
                    </button>
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
        {note === null ? null : (
          <p role="alert" className="text-sm text-gray-600">
            {note}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-node-id={NODE.save}
            onClick={pressPending(save)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {save.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.complete}
            onClick={pressComplete}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            {complete.label}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
