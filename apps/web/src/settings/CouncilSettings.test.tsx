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

// 같은 화면이 열린 채 학생회가 다시 읽히면(403 뒤 다시 읽기, 다른 곳의 저장) 입력칸이 서버의 새 값으로 다시 채워진다.
test('열린 채 학생회가 바뀌면 바뀐 쪽의 입력칸을 서버 값으로 다시 채우고, 고치던 다른 쪽과 같은 값의 다시 읽기는 건드리지 않는다', () => {
  mockApi()
  const first = councilView('c1', { permissions: LEADER_PERMISSIONS })
  const view = render(<CouncilSettings view={first} onSaved={() => {}} onForbidden={() => {}} />)
  fireEvent.change(screen.getByLabelText('기수 이름'), { target: { value: '2027' } })
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '고치던 학교' } })
  // 내용이 같은 새 학생회 객체(다시 읽기)는 고치던 값을 지우지 않는다.
  view.rerender(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  expect((screen.getByLabelText('학교') as HTMLInputElement).value).toBe('고치던 학교')
  // 학생회 정보만 바뀌면 그 쪽만 서버 값으로 채우고, 기수 쪽에서 고치던 값은 그대로 둔다.
  view.rerender(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS, name: '소프트웨어학부 학생회' })} onSaved={() => {}} onForbidden={() => {}} />)
  expect((screen.getByLabelText('학생회 이름') as HTMLInputElement).value).toBe('소프트웨어학부 학생회')
  expect((screen.getByLabelText('학교') as HTMLInputElement).value).toBe('한양대학교 ERICA')
  expect((screen.getByLabelText('기수 이름') as HTMLInputElement).value).toBe('2027')
  // 기수가 바뀌면 기수 쪽을 채운다.
  const next = councilView('c1', { permissions: LEADER_PERMISSIONS, name: '소프트웨어학부 학생회' })
  next.cohort = { ...next.cohort, name: '2028', startsOn: '2028-01-01', endsOn: '2028-12-31' }
  view.rerender(<CouncilSettings view={next} onSaved={() => {}} onForbidden={() => {}} />)
  expect((screen.getByLabelText('기수 이름') as HTMLInputElement).value).toBe('2028')
  expect((screen.getByLabelText('임기 시작') as HTMLInputElement).value).toBe('2028-01-01')
})

test('저장했어요 문구는 다시 고치는 순간 사라진다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/settings', () => json(councilView('c1', { name: '소프트웨어학부 학생회' })))
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부 학생회' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  // 기수 쪽을 고쳐도 학생회 정보의 문구는 그대로 두고, 학생회 정보를 고치면 사라진다.
  fireEvent.change(screen.getByLabelText('기수 이름'), { target: { value: '2027' } })
  expect(within(form).getByText('저장했어요.')).toBeTruthy()
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '다른 학교' } })
  expect(within(form).queryByText('저장했어요.')).toBeNull()
})

test('임기 끝이 시작보다 뒤가 아니면 저장 버튼을 끄고 까닭을 보인다', () => {
  mockApi()
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '지금 기수' })
  const save = within(form).getByRole('button', { name: '기수 저장' }) as HTMLButtonElement
  expect(within(form).queryByText('임기 끝은 시작보다 뒤여야 해요.')).toBeNull()
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2025-12-31' } })
  expect(within(form).getByText('임기 끝은 시작보다 뒤여야 해요.')).toBeTruthy()
  expect(save.disabled).toBe(true)
  // 같은 날도 뒤가 아니다.
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2026-01-01' } })
  expect(within(form).getByText('임기 끝은 시작보다 뒤여야 해요.')).toBeTruthy()
  expect(save.disabled).toBe(true)
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2026-06-30' } })
  expect(within(form).queryByText('임기 끝은 시작보다 뒤여야 해요.')).toBeNull()
  expect(save.disabled).toBe(false)
})
