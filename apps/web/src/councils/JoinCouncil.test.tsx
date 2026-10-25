// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { InvitePreviewResponse, MeProfileResponse } from '@vada/contracts'
import { myCouncil } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import JoinCouncil from './JoinCouncil'
import { unitLabels } from './unit-labels'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const council = (
  extra: Partial<InvitePreviewResponse['council']> = {},
): InvitePreviewResponse['council'] => ({
  id: 'c1',
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  cohortName: '2026',
  ...extra,
})

function open(preview = council(), profile: MeProfileResponse = { name: null }) {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: preview, joined: false }))
  api.on('GET', '/api/me/profile', () => json(profile))
  api.on('POST', '/api/organizations/join', () => json({ council: myCouncil('c1') }))
  const onJoined = vi.fn()
  render(
    <JoinCouncil
      code="ABCD2345"
      googleName="Kim Hoejang"
      leaveLabel="나가기"
      onJoined={onJoined}
      onLeave={() => {}}
    />,
  )
  return { api, onJoined }
}

const factOf = (label: string) =>
  screen.queryAllByRole('term').find(term => term.textContent === label)?.nextElementSibling
    ?.textContent

test('초대 확인 카드는 제목 아래에 유형, 대표 범위, 운영 연도를 보인다', async () => {
  open()
  await screen.findByRole('heading', { name: '컴퓨터학부 학생회' })
  expect(factOf('유형')).toBe(unitLabels.department)
  expect(factOf('대표 범위')).toBe('한양대학교 ERICA')
  expect(factOf('운영 연도')).toBe('2026년')
})

test('지금 기수가 없으면 운영 연도 줄이 없다', async () => {
  open(council({ cohortName: null }))
  await screen.findByRole('heading', { name: '컴퓨터학부 학생회' })
  expect(factOf('운영 연도')).toBeUndefined()
  expect(factOf('대표 범위')).toBe('한양대학교 ERICA')
})

test('이어진 운영진이 없으면 Google 이름이 든 내 이름 칸이 있고, 그 이름으로 들어간다', async () => {
  const { api, onJoined } = open()
  const field = await screen.findByLabelText<HTMLInputElement>('내 이름')
  expect(field.value).toBe('Kim Hoejang')
  fireEvent.change(field, { target: { value: '김회장' } })
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith('c1'))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    code: 'ABCD2345',
    memberName: '김회장',
  })
})

test('내 이름을 비우면 칸 아래에 알리고 들어가지 않는다', async () => {
  const { api } = open()
  const field = await screen.findByLabelText('내 이름')
  fireEvent.change(field, { target: { value: '  ' } })
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('이름을 입력해 주세요')).toBeTruthy()
  expect(field.getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('내 이름이 너무 길면 칸 아래에 알리고 들어가지 않는다', async () => {
  const { api } = open()
  const field = await screen.findByLabelText('내 이름')
  fireEvent.change(field, { target: { value: '가'.repeat(51) } })
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('더 짧게 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('이미 이어진 운영진이면 칸 없이 그 이름을 보이고, 이름 없이 들어간다', async () => {
  const { api, onJoined } = open(council(), { name: '김회장' })
  const card = await screen.findByRole('form', { name: '학생회 들어가기' })
  await within(card).findByText('김회장')
  expect(screen.queryByLabelText('내 이름')).toBeNull()
  expect(factOf('내 이름')).toBe('김회장')
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith('c1'))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ code: 'ABCD2345' })
})

test('내 이름을 읽지 못해도 Google 이름이 든 칸을 보인다', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: council(), joined: false }))
  api.on('GET', '/api/me/profile', () => json({ error: 'x' }, 500))
  render(
    <JoinCouncil
      code="ABCD2345"
      googleName="김회장"
      leaveLabel="나가기"
      onJoined={() => {}}
      onLeave={() => {}}
    />,
  )
  expect((await screen.findByLabelText<HTMLInputElement>('내 이름')).value).toBe('김회장')
})

test('이미 들어온 학생회면 내 이름을 묻지 않고 그 학생회를 연다', async () => {
  const api = mockApi()
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: council(), joined: true }))
  const onJoined = vi.fn()
  render(
    <JoinCouncil
      code="ABCD2345"
      googleName="김회장"
      leaveLabel="나가기"
      onJoined={onJoined}
      onLeave={() => {}}
    />,
  )
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith('c1'))
  expect(api.calls.some(call => call.path === '/api/me/profile')).toBe(false)
  api.assertNoUnexpectedRequests()
})

test('내 이름 칸에서 Enter로도 들어간다', async () => {
  const { api, onJoined } = open()
  await screen.findByLabelText('내 이름')
  fireEvent.submit(screen.getByRole('form', { name: '학생회 들어가기' }))
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith('c1'))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    code: 'ABCD2345',
    memberName: 'Kim Hoejang',
  })
})
