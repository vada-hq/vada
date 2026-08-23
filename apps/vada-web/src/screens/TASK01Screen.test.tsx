import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenRouter } from './ScreenRouter'
import { task01 } from '../spec/screens'
import type { ItemListSpec, SelectSpec } from '../spec/types'
import { getOptionSource } from '../option-sources/catalog'
import { readListSource } from '../data-sources/catalog'

// TASK-01의 완료 조건. 이 사이클에서 새로 연 자리는 itemList.params의 고정값
// (value) 하나뿐이고, 나머지는 MY-01·OPS-00이 연 자리를 그대로 쓴다.

function renderTASK01(onNavigate: (screenId: string) => void = () => {}) {
  render(
    <ScreenRouter
      screenId="TASK-01"
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={onNavigate}
    />,
  )
}

function columnsOf(): ItemListSpec[] {
  return task01.elements
    .map((element) => element.spec)
    .filter((spec): spec is ItemListSpec => spec.type === 'itemList')
}

describe('TASK-01 스펙 준수', () => {
  it('열마다 명세가 정한 고정값으로 따로 조회한다', () => {
    renderTASK01()
    const scope = task01.elements.find((element) => element.spec.type === 'select')
      ?.spec as SelectSpec

    for (const column of columnsOf()) {
      const params = Object.fromEntries(
        Object.entries(column.params ?? {}).map(([name, argument]) => [
          name,
          argument.value ?? (scope.initialValue ?? ''),
        ]),
      )
      const rows = readListSource(column.dataSourceKey, params)
      const heading = screen.getByRole('heading', {
        name: new RegExp(`^${column.title}`),
      })
      // 열의 건수는 명세에 없다 — 항목 수에서 나온다.
      expect(heading).toHaveTextContent(String(rows.length))
      for (const row of rows) {
        expect(screen.getByText(String(row.title))).toBeInTheDocument()
      }
    }
  })

  it('보는 범위를 바꾸면 모든 열이 다시 조회된다', async () => {
    const user = userEvent.setup()
    renderTASK01()
    const scope = task01.elements.find((element) => element.spec.type === 'select')
      ?.spec as SelectSpec
    const source = getOptionSource(scope.optionsSource.key)
    if (source.type !== 'static') throw new Error('static 출처여야 한다')

    const other = source.options.find(
      (option) => String(option.value) !== scope.initialValue,
    )
    await user.click(screen.getByRole('radio', { name: String(other?.label) }))

    for (const column of columnsOf()) {
      const params = Object.fromEntries(
        Object.entries(column.params ?? {}).map(([name, argument]) => [
          name,
          argument.value ?? String(other?.value),
        ]),
      )
      const rows = readListSource(column.dataSourceKey, params)
      expect(
        screen.getByRole('heading', { name: new RegExp(`^${column.title}`) }),
      ).toHaveTextContent(String(rows.length))
    }
  })

  it('상태 칩은 라벨과 단위를 명세에서 읽는다', () => {
    renderTASK01()
    const summary = task01.elements.find((element) => element.spec.type === 'summary')
      ?.spec
    if (summary?.type !== 'summary') throw new Error('summary가 없다')
    const chips = within(screen.getByTestId('task01-alerts'))
    for (const item of summary.items ?? []) {
      const chip = chips.getByText(item.label).parentElement
      expect(chip?.textContent).toContain(item.label)
      expect(chip?.textContent).toContain(item.unit ?? '')
    }
  })

  it('카드를 누르면 itemAction이 선언한 대로 동작한다', async () => {
    const user = userEvent.setup()
    renderTASK01()
    const column = columnsOf().find((spec) => spec.itemAction?.type === 'pending')
    if (column?.itemAction?.type !== 'pending') throw new Error('pending 계약이 없다')

    await user.click(screen.getByRole('button', { name: /주간 운영회의 자료 준비/ }))
    expect(screen.getByText(column.itemAction.note)).toBeInTheDocument()
  })
})
