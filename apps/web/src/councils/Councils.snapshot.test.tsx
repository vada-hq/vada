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
  // 기본 운영 연도가 올해라, 날짜만 고정한다.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T03:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const html = snapshotHtml

// 만들기는 열 때 내 이름(이어진 운영진)을 읽는다. 이 시험들은 아직 이어지지 않은 사람이다.
function createForm(api: ReturnType<typeof mockApi>, onCreated = () => {}) {
  api.on('GET', '/api/me/profile', () => json({ name: null }))
  render(<CreateCouncilForm userName="김구글" onCreated={onCreated} onCancel={() => {}} />)
}
function fillBasic() {
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부' } })
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '한양대학교' } })
}
async function toStructure() {
  fillBasic()
  fireEvent.click(screen.getByRole('button', { name: '다음: 조직 구조' }))
  await screen.findByRole('heading', { level: 2, name: '조직 구조' })
}
async function submitCreate() {
  await toStructure()
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
}

test('만들기: 입력 전', () => {
  createForm(mockApi())
  expect(html()).toMatchSnapshot()
})

test('만들기: 운영 연도 오류', () => {
  createForm(mockApi())
  fillBasic()
  fireEvent.change(screen.getByLabelText('운영 연도'), { target: { value: '2025' } })
  // 양식을 연 채 한국의 새해(2027년)가 되면 2025는 선택지 밖이다. 문제는 누를 때 칸 아래에 보인다.
  vi.setSystemTime(new Date('2026-12-31T15:00:00Z'))
  fireEvent.click(screen.getByRole('button', { name: '다음: 조직 구조' }))
  expect(screen.getByText('운영 연도를 다시 골라 주세요')).toBeTruthy()
  expect(html()).toMatchSnapshot()
})

test('만들기: 조직 구조', async () => {
  createForm(mockApi())
  await toStructure()
  expect(html()).toMatchSnapshot()
})

test('만들기: 진행 중', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => deferredResponse().promise)
  createForm(api)
  await submitCreate()
  expect(html()).toMatchSnapshot()
})

test('만들기: 오류', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => json({ error: 'EMAIL_IN_USE' }, 409))
  createForm(api)
  await submitCreate()
  await screen.findByText(/이메일을 다른 계정이 쓰고 있어요/)
  expect(html()).toMatchSnapshot()
})

test('만들기: 성공하면 초대 링크', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/create', () => json({ council: myCouncil('c9') }))
  api.on('GET', '/api/organizations/c9/invite', () => json({ code: 'ABCD2345' }))
  createForm(api)
  await submitCreate()
  await screen.findByRole('textbox', { name: '초대 링크' })
  expect(html()).toMatchSnapshot()
})

const preview = (joined = false) => ({
  council: {
    id: 'c1',
    name: '컴퓨터학부 학생회',
    unit: 'department',
    schoolName: '한양대학교 ERICA',
    cohortName: '2026',
  },
  joined,
})
function join(onJoined = () => {}) {
  render(
    <JoinCouncil
      code="ABCD2345"
      googleName="김회장"
      leaveLabel="나가기"
      onJoined={onJoined}
      onLeave={() => {}}
    />,
  )
}
// 이어진 운영진이 없는 로그인: Google 이름이 든 '내 이름' 칸이 나온다.
const noProfile = (api: ReturnType<typeof mockApi>, name: string | null = null) =>
  api.on('GET', '/api/me/profile', () => json({ name }))

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
  noProfile(api)
  join()
  await screen.findByRole('button', { name: '들어가기' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 이미 이어진 운영진', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  noProfile(api, '김회장')
  join()
  await screen.findByRole('button', { name: '들어가기' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 진행 중', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  noProfile(api)
  api.on('POST', '/api/organizations/join', () => deferredResponse().promise)
  join()
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  await screen.findByRole('button', { name: '들어가는 중…' })
  expect(html()).toMatchSnapshot()
})

test('들어오기: 오류', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json(preview()))
  noProfile(api)
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
      user={{ id: 'u1', name: '김회장', email: 'kim.google@example.com' }}
      userId="u1"
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
  api.on('GET', '/api/me/profile', () => json({ name: null }))
  mine()
  await screen.findByRole('form', { name: '초대 코드로 들어가기' })
  expect(html()).toMatchSnapshot()
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  await screen.findByRole('form', { name: '학생회 만들기' })
  expect(html()).toMatchSnapshot()
})
