// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { json, mockApi } from '@/test-support/mock-api'
import InviteCard from './InviteCard'

// 초대 카드를 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 5).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function serve(status = 200) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/invite', () =>
    status === 200 ? json({ code: 'ABCD2345' }) : json({ error: 'x' }, status),
  )
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json({ code: 'WXYZ6789' }))
}
function html() {
  return document.body.innerHTML.replace(/«r[0-9a-z]+»/g, '«id»').replaceAll('><', '>\n<')
}

test('불러오는 중', () => {
  serve()
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  expect(html()).toMatchSnapshot()
})

test('초대 링크', async () => {
  serve()
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  await screen.findByRole('region', { name: '초대 링크' })
  expect(html()).toMatchSnapshot()
})

test('불러오기 오류', async () => {
  serve(500)
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  await screen.findByRole('button', { name: '다시 시도' })
  expect(html()).toMatchSnapshot()
})

test('권한 없음', async () => {
  serve(403)
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  await screen.findByRole('button', { name: '다시 시도' })
  expect(html()).toMatchSnapshot()
})

test('코드를 바꾼 뒤', async () => {
  serve()
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: '코드 바꾸기' }))
  await screen.findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.')
  expect(html()).toMatchSnapshot()
})
