// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { snapshotHtml } from '@/test-support/snapshot-html'
import CouncilSettings from './CouncilSettings'

// 학생회 설정을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 6).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function show(permissions = LEADER_PERMISSIONS, onForbidden = () => {}) {
  render(
    <CouncilSettings
      view={councilView('c1', { permissions })}
      onSaved={() => {}}
      onForbidden={onForbidden}
    />,
  )
}
const html = snapshotHtml
function saveCouncil() {
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '새 이름' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  return form
}

test('입력 전: 회장단', () => {
  mockApi()
  show()
  expect(html()).toMatchSnapshot()
})

test('권한 없음: 보기만', () => {
  mockApi()
  show(MEMBER_PERMISSIONS)
  expect(html()).toMatchSnapshot()
})

test('임기 순서 오류', () => {
  mockApi()
  show()
  fireEvent.change(screen.getByLabelText('임기 끝'), { target: { value: '2025-12-31' } })
  // 문제는 누를 때 칸 아래에 보인다.
  fireEvent.click(screen.getByRole('button', { name: '기수 저장' }))
  expect(html()).toMatchSnapshot()
})

test('진행 중', () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/settings', () => deferredResponse().promise)
  show()
  saveCouncil()
  expect(html()).toMatchSnapshot()
})

test('성공', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/settings', () => json(councilView('c1')))
  show()
  const form = saveCouncil()
  await within(form).findByText('저장했어요.')
  expect(html()).toMatchSnapshot()
})

test('오류: 기간 밖', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/cohort', () => json({ error: 'COHORT_NOT_CURRENT' }, 400))
  show()
  const form = screen.getByRole('form', { name: '지금 기수' })
  fireEvent.change(within(form).getByLabelText('기수 이름'), { target: { value: '2027' } })
  fireEvent.click(within(form).getByRole('button', { name: '기수 저장' }))
  await within(form).findByText(/기간에 오늘이/)
  expect(html()).toMatchSnapshot()
})

test('오류: 권한을 잃음', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/settings', () => json({ error: 'FORBIDDEN' }, 403))
  const onForbidden = vi.fn()
  show(LEADER_PERMISSIONS, onForbidden)
  const form = saveCouncil()
  await vi.waitFor(() => expect(onForbidden).toHaveBeenCalledTimes(1))
  await within(form).findByText(/권한/)
  expect(html()).toMatchSnapshot()
})
