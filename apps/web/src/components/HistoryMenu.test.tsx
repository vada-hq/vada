// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HistoryMenu } from './HistoryMenu'

afterEach(cleanup)

const history = [
  { versionNo: 1, text: '첫 판' },
  { versionNo: 2, text: '둘째 판' },
]

function show() {
  render(<HistoryMenu history={history} line={version => version.text} />)
}

test('이력은 메뉴를 열기 전에는 보이지 않고, [이력 보기]로 오래된 판부터 열린다', async () => {
  show()
  expect(screen.queryByText('첫 판')).toBeNull()
  fireEvent.keyDown(screen.getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '이력 보기' }))
  const dialog = await screen.findByRole('dialog', { name: '이력' })
  expect(
    within(dialog)
      .getAllByRole('listitem')
      .map(item => item.textContent),
  ).toEqual(['첫 판', '둘째 판'])
})

test('[닫기]를 누르면 창이 닫히고 포커스가 ⋯ 버튼으로 돌아온다', async () => {
  show()
  fireEvent.keyDown(screen.getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '이력 보기' }))
  const dialog = await screen.findByRole('dialog', { name: '이력' })
  fireEvent.click(within(dialog).getByText('닫기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '더 보기' })),
  )
})
