import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenRouter } from './ScreenRouter'
import { ops00 } from '../spec/screens'
import type { SummarySpec } from '../spec/types'
import { readObjectSource } from '../data-sources/catalog'

// OPS-00 사이클에서 넓힌 summary(description·descriptionField·items[].unit·action)의
// 완료 조건이다. 기대값을 스펙과 카탈로그에서 읽으므로 명세를 고치면 따라간다.

function renderOPS00(onNavigate: (screenId: string) => void = () => {}) {
  render(
    <ScreenRouter
      screenId="OPS-00"
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={onNavigate}
    />,
  )
}

function summariesOf(): SummarySpec[] {
  return ops00.elements
    .map((element) => element.spec)
    .filter((spec): spec is SummarySpec => spec.type === 'summary')
}

describe('OPS-00 스펙 준수', () => {
  it('descriptionField는 서버가 완성한 문장을 그린다', () => {
    renderOPS00()
    for (const spec of summariesOf()) {
      if (spec.descriptionField === undefined || spec.dataSourceKey === undefined) {
        continue
      }
      const row = readObjectSource(spec.dataSourceKey)
      expect(screen.getByText(String(row[spec.descriptionField]))).toBeInTheDocument()
    }
  })

  it('description은 명세에 담긴 문장을 그대로 그린다', () => {
    renderOPS00()
    for (const spec of summariesOf()) {
      if (spec.description === undefined) continue
      expect(screen.getByText(spec.description)).toBeInTheDocument()
    }
  })

  it('값 뒤에 명세가 정한 단위를 붙인다', () => {
    renderOPS00()
    for (const spec of summariesOf()) {
      if (spec.dataSourceKey === undefined || spec.items === undefined) continue
      const row = readObjectSource(spec.dataSourceKey)
      // 카드 안에서만 찾는다 — 같은 숫자가 다른 카드에도 나온다.
      const card = screen.getByText(spec.title ?? '').closest('button')
      expect(card).not.toBeNull()
      for (const item of spec.items) {
        if (item.field === undefined) continue
        // 한 카드 안에서도 값이 겹친다(회의는 1건·1건). 항목 상자 단위로 본다.
        const box = within(card as HTMLElement).getByText(item.label!).parentElement
        expect(box?.textContent).toContain(item.label)
        expect(box?.textContent).toContain(`${row[item.field]}${item.unit ?? ''}`)
      }
    }
  })

  it('action의 문구를 그리고, 눌리면 선언한 대로 동작한다', async () => {
    const user = userEvent.setup()
    renderOPS00()
    const withAction = summariesOf().filter((spec) => spec.action !== undefined)
    expect(withAction.length).toBeGreaterThan(0)

    for (const spec of withAction) {
      if (spec.action?.label !== undefined) {
        expect(screen.getByText(spec.action.label)).toBeInTheDocument()
      }
    }

    // 상시 업무 카드는 TASK-01이 생기면서 진짜 이동이 됐다. pending인 것을 고른다.
    const pending = withAction.find((spec) => spec.action?.type === 'pending')
    if (pending?.action?.type !== 'pending') throw new Error('pending 카드가 없다')
    // 카드 제목이 다른 카드의 설명에도 나온다(캘린더 설명에 '회의'). 제목 노드로 찾는다.
    const card = screen.getByText(pending.title ?? '', { exact: true }).closest('button')
    await user.click(card as HTMLElement)
    expect(screen.getByText(pending.action.note)).toBeInTheDocument()
  })

  it('meta.footerNote를 그린다', () => {
    renderOPS00()
    expect(screen.getByText(ops00.meta?.footerNote ?? '')).toBeInTheDocument()
  })
})
