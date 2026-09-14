import type { ReactNode } from 'react'
import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { computeNumber, formatComputed } from '../../spec/compute'
import type { ListSpec } from '../../spec/types'
import { AddButton, DepartmentCell, RemoveButton, RowInput, ScreenInput } from './BudgetPlanFields'
import { ASSET, EVENT_OF_ROW, ITEM_NODE, NODE, ROW, SCREEN, SECTION } from './spec'
import type { BudgetPlanDraftModel } from './useBudgetPlanDraft'

const sectionTitle = (title: string | undefined) => (
  <h3 className="text-base font-semibold text-gray-900">{title}</h3>
)

function SourceRows({ model }: { model: BudgetPlanDraftModel }) {
  const list = model.specs.sources
  return (
    <>
      {model.sourceRowIds.map((rowId, index) => (
        <div key={rowId} className={ROW}>
          <div className="min-w-0 flex-1">
            <RowInput model={model} list={list} rowId={rowId} fieldKey="sourceName" first={index === 0} />
          </div>
          <div className="w-56 shrink-0">
            <RowInput model={model} list={list} rowId={rowId} fieldKey="sourceAmount" first={index === 0} />
          </div>
          <RemoveButton model={model} list={list} rowIds={model.sourceRowIds} rowId={rowId} />
        </div>
      ))}
    </>
  )
}

function BudgetRows({ model, event }: { model: BudgetPlanDraftModel; event: boolean }) {
  const list = event ? model.specs.eventItems : model.specs.items
  const rowIds = event ? model.shownEventRowIds : model.itemRowIds
  const allRowIds = event ? model.eventRowIds : model.itemRowIds
  const name: keyof typeof ITEM_NODE = event ? 'eventItemName' : 'itemName'
  const amount: keyof typeof ITEM_NODE = event ? 'eventItemAmount' : 'itemAmount'
  const department = event ? model.eventDepartmentSpec : model.departmentSpec
  const departmentNode = event ? ITEM_NODE.eventItemDepartment : ITEM_NODE.itemDepartment
  return (
    <>
      {rowIds.map((rowId, index) => (
        <div key={rowId} className={ROW}>
          <div className="min-w-0 flex-1">
            <RowInput model={model} list={list} rowId={rowId} fieldKey={name} first={index === 0} />
          </div>
          <div className="w-56 shrink-0">
            <RowInput model={model} list={list} rowId={rowId} fieldKey={amount} first={index === 0} />
          </div>
          <DepartmentCell
            model={model}
            list={list}
            rowId={rowId}
            spec={department}
            nodeId={index === 0 ? departmentNode : undefined}
          />
          <RemoveButton model={model} list={list} rowIds={allRowIds} rowId={rowId} />
        </div>
      ))}
    </>
  )
}

function listSection(
  nodeId: string,
  list: ListSpec,
  rows: ReactNode,
  add: ReactNode,
) {
  return (
    <section data-node-id={nodeId} aria-label={list.label} className={SECTION}>
      {sectionTitle(list.label)}
      {rows}
      {add}
    </section>
  )
}

/** 회계 기간, 수입원, 상시 항목, 행사별 항목과 합계를 표시한다. */
export function BudgetPlanSections({ model }: { model: BudgetPlanDraftModel }) {
  const { period, sources, items, eventItems, event, summaryAt } = model.specs

  return (
    <>
      <section data-node-id={NODE.period} aria-label={period.title} className={SECTION}>
        {sectionTitle(period.title)}
        <div className="grid grid-cols-2 gap-6 bg-white">
          <ScreenInput model={model} nodeId={NODE.periodStart} />
          <ScreenInput model={model} nodeId={NODE.periodEnd} />
        </div>
      </section>

      {listSection(
        NODE.sources,
        sources,
        <SourceRows model={model} />,
        <AddButton
          list={sources}
          rowIds={model.sourceRowIds}
          onAdd={() => model.addRow(sources, model.sourceRowIds)}
        />,
      )}

      {listSection(
        NODE.items,
        items,
        <BudgetRows model={model} event={false} />,
        <AddButton
          list={items}
          rowIds={model.itemRowIds}
          onAdd={() => model.addRow(items, model.itemRowIds)}
        />,
      )}

      <section data-node-id={NODE.eventItems} aria-label={eventItems.label} className={SECTION}>
        {sectionTitle(eventItems.label)}
        <div className="w-64">
          <Field htmlFor={event.fieldKey} nodeId={NODE.event} label={event.label} required={event.required}>
            <SearchSelect
              id={event.fieldKey}
              placeholder={event.placeholder}
              searchable={event.searchable}
              disabled={false}
              sourceKey={event.optionsSource.key}
              sourceParams={{}}
              value={
                model.chosenEvent === ''
                  ? null
                  : {
                      value: model.chosenEvent,
                      label: model.labelOf(
                        model.eventOptions,
                        event.fieldKey,
                        model.chosenEvent,
                      ),
                    }
              }
              onSelect={(option) => model.setValue(event.fieldKey, option.value, option.label)}
              chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.eventChevron} className="size-4" />}
            />
          </Field>
        </div>
        <BudgetRows model={model} event />
        <AddButton
          list={eventItems}
          rowIds={model.eventRowIds}
          onAdd={() =>
            model.addRow(eventItems, model.eventRowIds, {
              [EVENT_OF_ROW]: model.chosenEvent,
            })
          }
          blocked={model.chosenEvent === ''}
        />
      </section>

      <div className="flex flex-col gap-2">
        {[NODE.incomeTotal, NODE.itemTotal, NODE.eventTotal].map((nodeId) => {
          const item = summaryAt(nodeId).items![0]
          return (
            <p key={nodeId} data-node-id={nodeId} className="text-sm font-semibold text-gray-900">
              <span>{item.label}</span>{' '}
              <span>{formatComputed(computeNumber(item.compute!, { draft: model.draft }))}</span>
              <span>{item.unit}</span>
            </p>
          )
        })}
      </div>
    </>
  )
}
