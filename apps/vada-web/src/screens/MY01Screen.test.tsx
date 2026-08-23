import { expect, it, describe } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenRouter } from './ScreenRouter'
import { shell } from '../components/AppShell'
import { my01 } from '../spec/screens'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'
import { getOptionSource } from '../option-sources/catalog'
import { readObjectSource } from '../data-sources/catalog'

// MY-01 사이클에서 새로 연 자리(select.optionCounts · itemList.params ·
// itemList.itemAction · shell.json)의 완료 조건이다. 기대값을 스펙과 카탈로그에서
// 읽으므로 명세를 고치면 검사가 따라간다.

function renderMY01(onNavigate: (screenId: string) => void = () => {}) {
  render(
    <ScreenRouter
      screenId="MY-01"
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={onNavigate}
    />,
  )
}

function specOf<T>(nodeId: string): T {
  const found = my01.elements.find((element) => element.source.nodeId === nodeId)
  if (!found) throw new Error(`nodeId ${nodeId} 없음`)
  return found.spec as T
}

describe('MY-01 스펙 준수', () => {
  it('summary의 라벨-값 쌍을 데이터 출처에서 읽어 그린다', () => {
    renderMY01()
    const summary = specOf<SummarySpec>('16:401')
    const row = readObjectSource(summary.dataSourceKey ?? '')
    // 같은 문구가 사이드바 메뉴와 탭에도 있고, 건수 '2건'은 두 타일에 겹친다.
    // 그래서 타일 하나 안에서 라벨과 값이 짝을 이루는지를 본다. design이 라벨과
    // 건수를 한 덩어리로 그리므로 화면도 한 덩어리다(MY01Screen.design.test).
    const tiles = within(screen.getByTestId('my01-alerts'))
    for (const item of summary.items ?? []) {
      const tile = tiles.getByText(
        `${item.label} ${row[item.field ?? '']}${item.unit ?? ''}`,
      )
      expect(tile.textContent).toContain(item.label)
      expect(tile.textContent).toContain(`${row[item.field ?? '']}건`)
    }
  })

  it('탭은 선택지를 명세에서, 건수를 데이터에서 읽는다', () => {
    renderMY01()
    const tab = specOf<SelectSpec>('16:422')
    const source = getOptionSource(tab.optionsSource.key)
    if (source.type !== 'static') throw new Error('static 출처여야 한다')
    const counts = readObjectSource(tab.optionCounts?.dataSourceKey ?? '')

    for (const option of source.options) {
      const control = screen.getByRole('tab', { name: new RegExp(option.label) })
      // 건수는 선택지의 value로 찾는다 — 이 일치가 둘을 잇는 유일한 계약이다.
      expect(within(control).getByText(String(counts[String(option.value)]))).toBeInTheDocument()
    }

    const initial = source.options.find(
      (option) => String(option.value) === tab.initialValue,
    )
    expect(
      screen.getByRole('tab', { name: new RegExp(initial?.label ?? '') }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('탭을 바꾸면 목록을 다시 조회한다', async () => {
    const user = userEvent.setup()
    renderMY01()

    expect(screen.getByText('행사 안전 안내문 검토')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /진행 중인 업무/ }))

    expect(screen.queryByText('행사 안전 안내문 검토')).not.toBeInTheDocument()
    expect(screen.getByText('참가자 모집 공지 작성')).toBeInTheDocument()
  })

  it('검색어도 조회 인자다 — 걸러진 결과만 남는다', async () => {
    const user = userEvent.setup()
    renderMY01()
    const search = my01.elements.find((element) => element.spec.type === 'input')
    if (!search) throw new Error('검색 입력이 없다')

    await user.type(
      screen.getByLabelText((search.spec as { label: string }).label),
      '학생 건의',
    )

    expect(screen.getByText('학생 건의 답변 문안 검토')).toBeInTheDocument()
    expect(screen.queryByText('행사 안전 안내문 검토')).not.toBeInTheDocument()
  })

  it('항목을 누르면 itemAction이 선언한 대로 동작한다', async () => {
    const user = userEvent.setup()
    renderMY01()
    const tasks = specOf<ItemListSpec>('16:448')
    if (tasks.itemAction?.type !== 'pending') {
      throw new Error('이 검사는 pending 계약을 본다')
    }

    await user.click(screen.getByRole('button', { name: /행사 안전 안내문 검토/ }))

    expect(screen.getByText(tasks.itemAction.note)).toBeInTheDocument()
  })

  it('셸의 메뉴를 그리고 현재 화면을 표시한다', () => {
    renderMY01()
    for (const item of shell.navigation) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '내 업무' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('아직 명세되지 않은 메뉴는 비활성이다', () => {
    renderMY01()
    for (const item of shell.navigation) {
      const control = screen.getByRole('button', { name: item.label })
      if (item.targetScreenId === undefined) {
        expect(control).toBeDisabled()
      } else {
        expect(control).toBeEnabled()
      }
    }
  })

  it('셸의 메뉴로 다른 화면에 간다', async () => {
    const user = userEvent.setup()
    const visited: string[] = []
    renderMY01((screenId) => visited.push(screenId))

    await user.click(screen.getByRole('button', { name: '홈' }))
    expect(visited).toEqual(['HOME-01K'])
  })
})
