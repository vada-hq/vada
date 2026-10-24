// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { snapshotHtml } from '@/test-support/snapshot-html'
import { myCouncil } from '@/test-support/council-fixtures'
import CreateCouncilForm from './CreateCouncilForm'
import JoinCouncil from './JoinCouncil'
import MyCouncils from './MyCouncils'

// 학생회 만들기·들어오기·내 학생회를 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 6).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
beforeEach(() => {
  // 기본 임기가 올해라, 날짜만 고정한다.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T03:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const html = snapshotHtml

function createForm(onCreated = () => {}) {
  render(<CreateCouncilForm onCreated={onCreated} onCancel={() => {}} />)
}
function submitCreate() {
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부' } })
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '한양대학교' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
}

test('만들기: 입력 전', () => {
  mockApi()
  createForm()
  expect(html()).toMatchSnapshot()
})

test('만들기: 임기 순서 오류', () => {
  mockApi()
  createForm()
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부' } })
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '한양대학교' } })
  fireEvent.change(screen.getByLabelText('임기 끝'), { target: { value: '2025-12-31' } })
  // 문제는 누를 때 칸 아래에 보인다.
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  expect(html()).toMatchSnapshot()
})

test('만들기: 진행 중', () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => deferredResponse().promise)
  createForm()
  submitCreate()
  expect(html()).toMatchSnapshot()
})

test('만들기: 오류', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => json({ error: 'COHORT_NOT_CURRENT' }, 400))
  createForm()
  submitCreate()
  await screen.findByText(/임기에 오늘이/)
  expect(html()).toMatchSnapshot()
})

test('만들기: 성공', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => json({ council: myCouncil('c9') }))
  const onCreated = vi.fn()
  createForm(onCreated)
  submitCreate()
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(myCouncil('c9')))
  expect(html()).toMatchSnapshot()
})

const preview = (joined = false) => ({ council: { id: 'c1', name: '컴퓨터학부 학생회' }, joined })
function join(onJoined = () => {}) {
  render(<JoinCouncil code="ABCD2345" leaveLabel="나가기" onJoined={onJoined} onLeave={() => {}} />)
}

test('들어오기: 불러오는 중', () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => deferredResponse().promise)
  join()
  expect(html()).toMatchSnapshot()
})

test('들어오기: 없는 코드', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json({ error: 'NOT_FOUND' }, 404))
  join()
  await screen.findByText(/초대 코드가 올바르지/)
  expect(html()).toMatchSnapshot()
})

test('들어오기: 확인 실패', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json({ error: 'x' }, 500))
  join()
  await screen.findByRole('button', { name: '다시 시도' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 묻기', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  join()
  await screen.findByRole('button', { name: '들어가기' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 진행 중', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  api.on('POST', '/api/organizations/join', () => deferredResponse().promise)
  join()
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  await screen.findByRole('button', { name: '들어가는 중…' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 오류', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  api.on('POST', '/api/organizations/join', () => json({ error: 'NO_CURRENT_COHORT' }, 409))
  join()
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  await screen.findByText(/지금 들어갈 수 있는 기수/)
  expect(html()).toMatchSnapshot()
})

test('들어오기: 이미 들어옴', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview(true)))
  const onJoined = vi.fn()
  join(onJoined)
  await vi.waitFor(() => expect(onJoined).toHaveBeenCalledWith('c1'))
  expect(html()).toMatchSnapshot()
})

function mine() {
  const card = (content: ReactNode) => <div>{content}</div>
  render(
    <MyCouncils
      user={{ name: '김회장' }}
      card={card}
      onEnterCode={() => {}}
      logoutBusy={false}
      onLogout={() => {}}
    />,
  )
}

test('내 학생회: 불러오는 중', () => {
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => deferredResponse().promise)
  mine()
  expect(html()).toMatchSnapshot()
})

test('내 학생회: 불러오기 오류', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ error: 'x' }, 500))
  mine()
  await screen.findByRole('button', { name: '다시 확인' })
  expect(html()).toMatchSnapshot()
})

test('내 학생회: 학생회 없음, 만들기 열기', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils: [] }))
  mine()
  await screen.findByRole('form', { name: '초대 코드로 들어가기' })
  expect(html()).toMatchSnapshot()
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  await screen.findByRole('form', { name: '학생회 만들기' })
  expect(html()).toMatchSnapshot()
})
