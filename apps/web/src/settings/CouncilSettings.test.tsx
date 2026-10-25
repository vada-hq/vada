// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import CouncilSettings from './CouncilSettings'
import { asElement } from '@/test-support/elements'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('회장단은 학생회 정보와 직급 표시 이름을 고쳐 저장하고, 서버가 돌려준 학생회를 넘긴다', async () => {
  const api = mockApi()
  const saved = councilView('c1', { name: '소프트웨어학부 학생회' })
  api.on('POST', '/api/organizations/c1/settings', () => json(saved))
  const onSaved = vi.fn()
  render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={onSaved}
      onForbidden={() => {}}
    />,
  )
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '소프트웨어학부 학생회' },
  })
  fireEvent.change(within(form).getByLabelText('회장'), { target: { value: '위원장' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({
    name: '소프트웨어학부 학생회',
    unit: 'college',
    schoolName: '한양대학교 ERICA',
    titles: { president: '위원장', vicePresident: '부회장', head: '부장', viceHead: '부부장' },
  })
  expect(onSaved).toHaveBeenCalledWith(saved)
})

test('직급 표시 이름을 비우고 저장을 누르면 보내지 않고 그 칸 아래에 알린다', async () => {
  const api = mockApi()
  render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  const form = screen.getByRole('form', { name: '학생회 정보' })
  const field = within(form).getByLabelText('부부장')
  fireEvent.change(field, { target: { value: '  ' } })
  const save = asElement(
    within(form).getByRole('button', { name: '학생회 정보 저장' }),
    HTMLButtonElement,
  )
  expect(save.disabled).toBe(false)
  fireEvent.click(save)
  expect(within(form).getByText('부부장 표시를 입력해 주세요')).toBeTruthy()
  expect(field.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(field))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('임기 시작이 오늘 뒤면 저장하지 못한 까닭을 보인다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/cohort', () => json({ error: 'COHORT_NOT_STARTED' }, 409))
  render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  const form = screen.getByRole('form', { name: '지금 기수' })
  fireEvent.change(within(form).getByLabelText('임기 시작'), { target: { value: '2027-03-01' } })
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2028-02-29' } })
  fireEvent.click(within(form).getByRole('button', { name: '기수 저장' }))
  expect(await within(form).findByText('임기 시작은 오늘이나 그 전이어야 해요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({ name: '2026', startsOn: '2027-03-01', endsOn: '2028-02-29' })
})

test('직급 없는 운영진은 보기만 하고 저장 버튼이 없다', () => {
  const api = mockApi()
  render(
    <CouncilSettings
      view={councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  expect(screen.getByText('회장단만 고칠 수 있어요.')).toBeTruthy()
  expect(asElement(screen.getByLabelText('학생회 이름'), HTMLInputElement).readOnly).toBe(true)
  expect(asElement(screen.getByLabelText('단위'), HTMLSelectElement).disabled).toBe(true)
  expect(asElement(screen.getByLabelText('기수 이름'), HTMLInputElement).readOnly).toBe(true)
  expect(screen.queryByRole('button')).toBeNull()
  expect(api.calls).toEqual([])
})

// 같은 화면이 열린 채 학생회가 다시 읽히면(403 뒤 다시 읽기, 다른 곳의 저장) 입력칸이 서버의 새 값으로 다시 채워진다.
test('열린 채 학생회가 바뀌면 고치지 않던 쪽의 입력칸을 서버 값으로 다시 채우고, 고치던 다른 쪽과 같은 값의 다시 읽기는 건드리지 않는다', () => {
  mockApi()
  const first = councilView('c1', { permissions: LEADER_PERMISSIONS })
  const view = render(<CouncilSettings view={first} onSaved={() => {}} onForbidden={() => {}} />)
  fireEvent.change(screen.getByLabelText('기수 이름'), { target: { value: '2027' } })
  // 내용이 같은 새 학생회 객체(다시 읽기)는 고치던 값을 지우지 않는다.
  view.rerender(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  // 학생회 정보만 바뀌면 그 쪽만 서버 값으로 채우고, 기수 쪽에서 고치던 값은 그대로 둔다.
  view.rerender(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS, name: '소프트웨어학부 학생회' })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  expect(asElement(screen.getByLabelText('학생회 이름'), HTMLInputElement).value).toBe(
    '소프트웨어학부 학생회',
  )
  expect(asElement(screen.getByLabelText('기수 이름'), HTMLInputElement).value).toBe('2027')
})

test('고치던 중인 쪽은 다시 읽은 서버 값으로 덮지 않고, 내 저장이 돌려준 값과 같아지면 다시 채운다', () => {
  mockApi()
  const first = councilView('c1', { permissions: LEADER_PERMISSIONS })
  const view = render(<CouncilSettings view={first} onSaved={() => {}} onForbidden={() => {}} />)
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '고치던 학교' } })
  const other = councilView('c1', { permissions: LEADER_PERMISSIONS, name: '다른 회장단이 바꿈' })
  view.rerender(<CouncilSettings view={other} onSaved={() => {}} onForbidden={() => {}} />)
  expect(asElement(screen.getByLabelText('학교'), HTMLInputElement).value).toBe('고치던 학교')
  expect(asElement(screen.getByLabelText('학생회 이름'), HTMLInputElement).value).not.toBe(
    '다른 회장단이 바꿈',
  )
  fireEvent.change(screen.getByLabelText('학생회 이름'), {
    target: { value: '다른 회장단이 바꿈' },
  })
  // 저장이 돌려준 값은 쓰던 값과 같으므로 기준이 새 값으로 옮겨 가, 다음 바깥 변경은 다시 채운다.
  const saved = councilView('c1', { permissions: LEADER_PERMISSIONS, name: '다른 회장단이 바꿈' })
  saved.council = { ...saved.council, schoolName: '고치던 학교' }
  view.rerender(<CouncilSettings view={saved} onSaved={() => {}} onForbidden={() => {}} />)
  const later = councilView('c1', { permissions: LEADER_PERMISSIONS, name: '또 바뀜' })
  later.council = { ...later.council, schoolName: '고치던 학교' }
  view.rerender(<CouncilSettings view={later} onSaved={() => {}} onForbidden={() => {}} />)
  expect(asElement(screen.getByLabelText('학생회 이름'), HTMLInputElement).value).toBe('또 바뀜')
})

test('저장했어요 문구는 다시 고치는 순간 사라진다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/settings', () =>
    json(councilView('c1', { name: '소프트웨어학부 학생회' })),
  )
  render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '소프트웨어학부 학생회' },
  })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  // 기수 쪽을 고쳐도 학생회 정보의 문구는 그대로 두고, 학생회 정보를 고치면 사라진다.
  fireEvent.change(screen.getByLabelText('기수 이름'), { target: { value: '2027' } })
  expect(within(form).getByText('저장했어요.')).toBeTruthy()
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '다른 학교' } })
  expect(within(form).queryByText('저장했어요.')).toBeNull()
})

test('임기 끝이 시작보다 뒤가 아니면 기수 저장을 눌러도 보내지 않고 임기 끝 칸 아래에 까닭을 보인다', () => {
  const api = mockApi()
  render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  const form = screen.getByRole('form', { name: '지금 기수' })
  const save = within(form).getByRole('button', { name: '기수 저장' }) as HTMLButtonElement
  const reason = '임기 시작보다 뒤의 날짜를 입력해 주세요'
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2025-12-31' } })
  // 누르기 전에는 보이지 않는다.
  expect(within(form).queryByText(reason)).toBeNull()
  expect(save.disabled).toBe(false)
  fireEvent.click(save)
  expect(within(form).getByText(reason)).toBeTruthy()
  expect(within(form).getByLabelText('임기 끝').getAttribute('aria-invalid')).toBe('true')
  // 같은 날도 뒤가 아니다.
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2026-01-01' } })
  expect(within(form).getByText(reason)).toBeTruthy()
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2026-06-30' } })
  expect(within(form).queryByText(reason)).toBeNull()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('고치던 중 회장단 권한을 잃으면 양식이 보기만으로 바뀌고 까닭이 보인다', () => {
  const view = render(
    <CouncilSettings
      view={councilView('c1', { permissions: LEADER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  expect(screen.queryByText('회장단만 고칠 수 있어요.')).toBeNull()
  view.rerender(
    <CouncilSettings
      view={councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })}
      onSaved={() => {}}
      onForbidden={() => {}}
    />,
  )
  expect(screen.getByText('회장단만 고칠 수 있어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
})
