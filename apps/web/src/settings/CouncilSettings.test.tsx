// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import CouncilSettings from './CouncilSettings'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('회장단은 학생회 정보와 직급 표시 이름을 고쳐 저장하고, 서버가 돌려준 학생회를 넘긴다', async () => {
  const api = mockApi()
  const saved = councilView('c1', { name: '소프트웨어학부 학생회' })
  api.on('POST', '/api/organizations/c1/settings', () => json(saved))
  const onSaved = vi.fn()
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={onSaved} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부 학생회' } })
  fireEvent.change(within(form).getByLabelText('회장'), { target: { value: '위원장' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({ name: '소프트웨어학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
    titles: { president: '위원장', vicePresident: '부회장', head: '부장', viceHead: '부부장' } })
  expect(onSaved).toHaveBeenCalledWith(saved)
})

test('직급 표시 이름을 비우면 저장 버튼이 꺼진다', () => {
  mockApi()
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('부부장'), { target: { value: '  ' } })
  expect((within(form).getByRole('button', { name: '학생회 정보 저장' }) as HTMLButtonElement).disabled).toBe(true)
})

test('기수 기간이 오늘을 담지 않으면 저장하지 못한 까닭을 보인다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/cohort', () => json({ error: 'COHORT_NOT_CURRENT' }, 409))
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '지금 기수' })
  fireEvent.change(within(form).getByLabelText('임기 시작'), { target: { value: '2027-03-01' } })
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2028-02-29' } })
  fireEvent.click(within(form).getByRole('button', { name: '기수 저장' }))
  expect(await within(form).findByText('기간에 오늘이 들어 있어야 해요. 그렇지 않으면 모든 운영진이 학생회를 열 수 없어요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({ name: '2026', startsOn: '2027-03-01', endsOn: '2028-02-29' })
})

test('직급 없는 운영진은 보기만 하고 저장 버튼이 없다', () => {
  const api = mockApi()
  render(<CouncilSettings view={councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  expect(screen.getByText('회장단만 고칠 수 있어요.')).toBeTruthy()
  expect((screen.getByLabelText('학생회 이름') as HTMLInputElement).readOnly).toBe(true)
  expect((screen.getByLabelText('단위') as HTMLSelectElement).disabled).toBe(true)
  expect((screen.getByLabelText('기수 이름') as HTMLInputElement).readOnly).toBe(true)
  expect(screen.queryByRole('button')).toBeNull()
  expect(api.calls).toEqual([])
})
