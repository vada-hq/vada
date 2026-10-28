// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MESSAGE_BODY_MAX, type ChatMessage } from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import { MessageMenuSection } from '@/ui-gallery/MenuSections'
import MessageItem from './MessageItem'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const draw = (mine = true, actions: ChatMessage['actions'] = ['message.delete']) =>
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

const edit = async () => {
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '메시지 고치기' }))
  return screen.findByRole('textbox', { name: '메시지' })
}

test('본인 표시와 관계없이 서버의 고치기 동작을 따르고 저장하면 새 글과 고침을 보인다', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        message('m1', '고친 글', {
          editedAt: '2026-10-28T01:00:00Z',
          actions: ['message.edit', 'message.delete'],
        }),
      ),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  draw(false, ['message.edit'])
  const input = await edit()
  expect((input as HTMLTextAreaElement).value).toBe('삭제할 글')
  fireEvent.change(input, { target: { value: '고친 글' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('고친 글')).toBeTruthy()
  expect(screen.getByText('(고침)')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(
    '/api/organizations/c1/messages/m1',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: '고친 글' }) }),
  )
})

test.each(['취소', 'Escape', '같은 글'])('고치기 %s는 요청 없이 원래 글을 남긴다', async action => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  draw(true, ['message.edit'])
  const input = await edit()
  if (action !== '같은 글') fireEvent.change(input, { target: { value: '저장하지 않은 글' } })
  if (action === 'Escape') fireEvent.keyDown(input, { key: 'Escape' })
  else fireEvent.click(screen.getByRole('button', { name: action === '같은 글' ? '저장' : '취소' }))
  await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  expect(screen.getByText('삭제할 글')).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
})

test('고치기 동작 없이 다른 동작만 있으면 고치기 메뉴가 없다', async () => {
  draw(true, ['message.delete'])
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  await screen.findByRole('menuitem', { name: '메시지 삭제' })
  expect(screen.queryByRole('menuitem', { name: '메시지 고치기' })).toBeNull()
})

test('409 실패는 고치던 글과 오류를 칸 아래에 남긴다', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'MESSAGE_LINKED' }), { status: 409 }),
      ),
  )
  draw(true, ['message.edit'])
  const input = await edit()
  fireEvent.change(input, { target: { value: '고치던 글' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('기록이 이어진 메시지는 고칠 수 없어요.')).toBeTruthy()
  expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('고치던 글')
})

test('빈 글은 누를 때 확인하고 요청 없이 입력칸에 오류와 초점을 둔다', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  draw(true, ['message.edit'])
  const input = await edit()
  fireEvent.change(input, { target: { value: '  ' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(input)
  expect(fetch).not.toHaveBeenCalled()
})

test('상한을 넘긴 글은 누를 때 확인하고 요청하지 않는다', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  draw(true, ['message.edit'])
  const input = await edit()
  fireEvent.change(input, { target: { value: '😀'.repeat(MESSAGE_BODY_MAX + 1) } })
  const save = screen.getByRole('button', { name: '저장' })
  expect((save as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(save)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(input)
  expect(fetch).not.toHaveBeenCalled()
})

test('저장 중에는 중복 전송을 막고 저장 후 다시 고치면 최신 본문을 쓴다', async () => {
  let resolve!: (value: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>(done => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', fetch)
  draw(true, ['message.edit'])
  const input = await edit()
  expect(document.activeElement).toBe(input)
  fireEvent.change(input, { target: { value: '고친 글' } })
  const save = screen.getByRole('button', { name: '저장' })
  fireEvent.click(save)
  expect(save.getAttribute('aria-busy')).toBe('true')
  fireEvent.click(save)
  expect(fetch).toHaveBeenCalledTimes(1)
  resolve(
    new Response(
      JSON.stringify(
        message('m1', '고친 글', {
          editedAt: '2026-10-28T01:00:00Z',
          actions: ['message.edit'],
        }),
      ),
    ),
  )
  await screen.findByText('고친 글')
  expect(((await edit()) as HTMLTextAreaElement).value).toBe('고친 글')
})

test('갤러리의 내 메시지 견본에서 고치기 칸이 열린다', async () => {
  render(<MessageMenuSection />)
  const input = await edit()
  expect((input as HTMLTextAreaElement).value).toContain('현수막 2개 사 주세요')
  expect(screen.getByRole('button', { name: '저장' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '취소' })).toBeTruthy()
})

test('고치던 메시지가 삭제로 갱신되면 입력 중인 본문과 고침 표시도 숨긴다', async () => {
  const view = draw(true, ['message.edit'])
  const input = await edit()
  fireEvent.change(input, { target: { value: '입력 중이던 글' } })
  view.rerender(
    <ul>
      <MessageItem
        councilId="c1"
        message={message('m1', '', {
          body: null,
          deletedAt: '2026-10-28T02:00:00Z',
          editedAt: '2026-10-28T01:00:00Z',
        })}
        mine
        continued={false}
        canRequest={false}
        canWriteExpense={false}
        onRequest={() => {}}
        onWriteExpense={() => {}}
      />
    </ul>,
  )
  expect(screen.getByText('삭제된 메시지')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByText('입력 중이던 글')).toBeNull()
  expect(screen.queryByText('(고침)')).toBeNull()
})
