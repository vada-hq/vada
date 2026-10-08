// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import { membership } from '../test-support/workflow-fixtures'
import CreateOrganization from './CreateOrganization'

let api: ReturnType<typeof mockApi>
beforeEach(() => { api = mockApi() })
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
const submit = () => screen.getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement

test('기본 부서를 채워 두고, 이름을 적어야 만들 수 있다', () => {
  render(<CreateOrganization onCreated={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByText('학생회가 이미 VADA를 쓰고 있다면 초대 링크로 참여하세요.')).toBeTruthy()
  expect(screen.getByText('항상 있어요')).toBeTruthy()
  expect([1, 2, 3, 4].map(n => (screen.getByLabelText(`부서 ${n} 이름`) as HTMLInputElement).value)).toEqual(['총무부', '기획부', '홍보부', '복지부'])
  expect(screen.getAllByText('구매 승인')).toHaveLength(1)
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '  ' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '제12대 학생회' } })
  expect(submit().disabled).toBe(false)
})

test('겹치는 이름이나 회장단은 막고, 빈 줄과 뺀 줄은 보내지 않는다', async () => {
  const onCreated = vi.fn()
  api.on('POST', '/api/organizations/create', () => json({ membership: { ...membership(), organization: { id: 'new', name: '제12대 학생회', inviteCode: 'ABCD2345' } } }, 201))
  render(<CreateOrganization onCreated={onCreated} onCancel={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: ' 제12대 학생회 ' } })
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: ' 총무부' } })
  expect(screen.getByText('부서 이름이 겹쳐요.')).toBeTruthy()
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: '회장단' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: '사무국' } })
  fireEvent.click(screen.getByRole('button', { name: '총무부 빼기' }))
  expect(screen.queryByText('구매 승인')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect(document.activeElement).toBe(screen.getByLabelText('부서 4 이름'))
  fireEvent.click(submit())
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new'))
  expect(api.calls.map(call => call.body)).toEqual([{ name: '제12대 학생회', departments: [
    { name: '사무국', handlesFinance: false }, { name: '홍보부', handlesFinance: false }, { name: '복지부', handlesFinance: false }] }])
})

test('실패하면 입력을 그대로 두고 다시 시도할 수 있다', async () => {
  api.on('POST', '/api/organizations/create', () => json({ error: 'UNAVAILABLE' }, 503))
  const onCancel = vi.fn()
  render(<CreateOrganization onCreated={vi.fn()} onCancel={onCancel} />)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '제12대 학생회' } })
  fireEvent.click(submit())
  expect((await screen.findByRole('alert')).textContent).toBe('학생회를 만들지 못했어요. 다시 시도해 주세요.')
  expect((screen.getByLabelText('학생회 이름') as HTMLInputElement).value).toBe('제12대 학생회')
  expect(submit().disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(onCancel).toHaveBeenCalledOnce()
})
