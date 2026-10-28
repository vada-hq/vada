// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { message } from '@/test-support/chat-fixtures'
import { MessageMenuSection } from '@/ui-gallery/MenuSections'
import MessageItem from './MessageItem'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const draw = (mine = true, actions: 'message.delete'[] = ['message.delete']) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={message('m1', '삭제할 글', {
          actions,
          photos: [{ id: 'f1' }],
          made: [{ id: 'e1', kind: 'expense', title: '마커 값', blocking: true }],
        })}
        mine={mine}
        continued={false}
        canRequest={false}
        canWriteExpense={false}
        onRequest={() => {}}
        onWriteExpense={() => {}}
      />
    </ul>,
  )
const open = async () => {
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '메시지 삭제' }))
  return screen.findByRole('dialog', { name: '메시지를 삭제할까요?' })
}

test('서버가 허용한 메시지만 삭제 메뉴가 있고 확인 전·닫기에는 요청하지 않는다', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  draw()
  const dialog = await open()
  expect(within(dialog).getByRole('button', { name: '삭제' })).toBeTruthy()
  expect(dialog.getAttribute('aria-describedby')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('button', { name: '메시지 동작' })).toBe(document.activeElement)
  expect(fetch).not.toHaveBeenCalled()
})

test.each([false, true])('서버가 삭제 동작을 주지 않으면 메뉴가 없다(내 메시지 %s)', mine => {
  draw(mine, [])
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
})

test('본인 여부 표시와 관계없이 서버가 준 삭제 동작을 따른다', async () => {
  draw(false)
  expect(await open()).toBeTruthy()
})

test('삭제 성공 후 본문·사진·메뉴는 사라지고 삭제된 메시지와 만든 지출은 남는다', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(message('m1', '', { body: null, deletedAt: '2026-10-28T00:00:00Z' })),
      {
        status: 200,
      },
    ),
  )
  vi.stubGlobal('fetch', fetch)
  draw()
  const dialog = await open()
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
  expect(await screen.findByText('삭제된 메시지')).toBeTruthy()
  expect(screen.queryByText('삭제할 글')).toBeNull()
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
  expect(screen.getByRole('button', { name: '지출 · 마커 값' })).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(
    '/api/organizations/c1/messages/m1/delete',
    expect.objectContaining({ method: 'POST', body: '{}' }),
  )
})

test.each([404, 500])(
  '삭제 실패(%s)는 확인 창에 문구를 보이고 원문과 사진을 남긴다',
  async status => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR' }), {
          status,
        }),
      ),
    )
    draw()
    const dialog = await open()
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await within(dialog).findByRole('alert')).toBeTruthy()
    expect(screen.getByText('삭제할 글')).toBeTruthy()
    expect(screen.getByRole('img', { hidden: true })).toBeTruthy()
  },
)

test('갤러리의 내 메시지 견본에서 삭제 확인 창이 열린다', async () => {
  render(<MessageMenuSection />)
  expect(await open()).toBeTruthy()
})
