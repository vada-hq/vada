// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FeeSettingsResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import FeeSettings from './FeeSettings'
import { duesRoster, feeSettings } from './fee-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })
const base = '/api/organizations/o'
function setup(body: FeeSettingsResponse = feeSettings()) {
  const api = mockApi()
  api.on('GET', `${base}/fee-settings`, () => json(body))
  render(<FeeSettings organizationId="o" />)
  return api
}
const region = (name: string) => screen.findByRole('region', { name })
const field = (container: HTMLElement, label: string) => within(container).getByLabelText(label) as HTMLInputElement
// 오늘은 한국 날짜로 2026년 10월 10일이다.
const today = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:00:00Z')) }

test('계좌가 없으면 안내와 계좌 넣기가 있고, 저장 버튼은 같은 스키마로 켜며 버전 0으로 보낸다', async () => {
  const api = setup(feeSettings({ account: null, accountHistory: [] }))
  const card = await region('받는 계좌')
  expect(within(card).getByText('아직 학생회 계좌가 없어요. 참가비를 받으려면 계좌를 넣어 주세요.')).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '계좌 넣기' }))
  const dialog = await screen.findByRole('dialog', { name: '받는 계좌' })
  expect(within(dialog).getByText('참가비를 받을 학생회 계좌예요. 신청한 학생에게 이 계좌를 알려요.')).toBeTruthy()
  fireEvent.change(field(dialog, '은행'), { target: { value: '카카오뱅크' } })
  fireEvent.change(field(dialog, '계좌번호'), { target: { value: '1234567' } })
  fireEvent.change(field(dialog, '예금주'), { target: { value: '컴퓨터학부 학생회' } })
  const save = within(dialog).getByRole('button', { name: '저장' })
  expect(save.hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '계좌번호'), { target: { value: '3333-01-1234567' } })
  expect(save.hasAttribute('disabled')).toBe(false)
  api.on('POST', `${base}/fee-account`, () => json(feeSettings()))
  fireEvent.click(save)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.at(-1)!.body).toEqual({ version: 0, bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' })
  expect(within(await region('받는 계좌')).getByText('3333-01-1234567')).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

test('계좌가 있으면 번호·예금주와 바꾼 기록을 보여 주고, 남이 먼저 바꿨으면 알리고 다시 불러온다', async () => {
  const api = setup(feeSettings({ accountHistory: [
    { id: 'h2', actor: { id: 'l', name: '회장' }, from: { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' },
      to: { bank: '국민은행', accountNumber: '123-45-678901', holder: '학생회' }, createdAt: '2026-10-02T03:00:00Z' },
    { id: 'h1', actor: { id: 'f', name: '김민준' }, from: null, to: { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' },
      createdAt: '2026-10-01T03:00:00Z' }] }))
  const card = await region('받는 계좌')
  expect(within(card).getByText('컴퓨터학부 학생회')).toBeTruthy()
  const history = within(card).getByRole('list', { name: '바꾼 기록' })
  expect(within(history).getAllByRole('listitem').map(item => item.textContent)).toEqual([
    expect.stringContaining('회장 — 국민은행 123-45-678901 (학생회)'), expect.stringContaining('김민준 — 카카오뱅크 3333-01-1234567 (컴퓨터학부 학생회)')])
  fireEvent.click(within(card).getByRole('button', { name: '바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '받는 계좌' })
  expect(field(dialog, '은행').value).toBe('카카오뱅크')
  fireEvent.change(field(dialog, '은행'), { target: { value: '국민은행' } })
  api.on('POST', `${base}/fee-account`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  expect(await within(dialog).findByText('다른 사람이 먼저 바꿨어요. 새로 불러온 내용을 확인해 주세요.')).toBeTruthy()
  expect(api.calls.at(-2)!.body).toEqual({ version: 1, bank: '국민은행', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' })
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
})

test('명단이 없으면 안내와 명단 올리기가 있고, 붙여 넣으면 미리 보기를 보이며 문제 줄이나 기한 밖 날짜가 있으면 올리지 못한다', async () => {
  today()
  const api = setup(feeSettings({ roster: null }))
  const card = await region('학생회비 납부 명단')
  expect(within(card).getByText('올린 명단이 없어요. 학생회비 납부자 참가비를 쓰려면 명단이 필요해요.')).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '명단 올리기' }))
  const dialog = await screen.findByRole('dialog', { name: '학생회비 납부 명단 올리기' })
  expect(within(dialog).getByText('엑셀에서 학번과 이름 두 칸을 골라 복사한 뒤 붙여 넣어 주세요.')).toBeTruthy()
  expect(field(dialog, '쓰는 기한').value).toBe('2027-02-28')
  fireEvent.change(field(dialog, '명단 이름'), { target: { value: '2026년 2학기 납부자' } })
  const paste = within(dialog).getByLabelText('붙여 넣기')
  fireEvent.change(paste, { target: { value: '학번\t이름\n2022-000001\t김바다\n2022000001\t김바다\n12345\t박해랑\n2022000003\t김하늘\t3학년' } })
  expect(within(dialog).getByText('1명을 찾았어요')).toBeTruthy()
  expect(within(dialog).getByText('같은 줄 1개를 하나로 합쳤어요')).toBeTruthy()
  expect(within(dialog).getByText('4번째 줄: 학번 형식이 아니에요')).toBeTruthy()
  expect(within(dialog).getByText('5번째 줄: 학번과 이름 두 칸만 넣어 주세요')).toBeTruthy()
  const upload = within(dialog).getByRole('button', { name: '올리기' })
  expect(upload.hasAttribute('disabled')).toBe(true)
  fireEvent.change(paste, { target: { value: '2022-000001\t김바다\n박해랑,2022000002' } })
  expect(upload.hasAttribute('disabled')).toBe(false)
  fireEvent.change(field(dialog, '쓰는 기한'), { target: { value: '2026-10-09' } })
  expect(within(dialog).getByText('쓰는 기한은 오늘부터 1년 안의 날짜로 골라 주세요.')).toBeTruthy()
  expect(upload.hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '쓰는 기한'), { target: { value: '2027-10-11' } })
  expect(upload.hasAttribute('disabled')).toBe(false)
  api.on('POST', `${base}/dues-roster`, () => json(feeSettings()))
  fireEvent.click(upload)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.at(-1)!.body).toEqual({ version: 0, label: '2026년 2학기 납부자', useUntil: '2027-10-11',
    members: [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022000002', name: '박해랑' }] })
  api.assertNoUnexpectedRequests()
})

test('명단이 있으면 이름·인원·기한·올린 사람을 보이고, 찾기와 새로 올리기 안내, 지우기 확인이 있다', async () => {
  const many = Array.from({ length: 51 }, (_, n) => ({ studentId: String(2024000000 + n), name: `김학생${n}` }))
  const api = setup(feeSettings({ roster: duesRoster({ members: [...duesRoster().members, ...many] }) }))
  const card = await region('학생회비 납부 명단')
  expect(within(card).getByText('2026년 2학기 납부자')).toBeTruthy()
  expect(within(card).getByText('54명')).toBeTruthy()
  expect(within(card).getByText('2027년 2월 28일까지 쓰고, 그다음 날 지워요.')).toBeTruthy()
  expect(within(card).getByText(/김민준/)).toBeTruthy()
  const search = within(card).getByLabelText('이름이나 학번으로 찾기')
  fireEvent.change(search, { target: { value: '박해' } })
  expect(within(card).getByText('박해랑')).toBeTruthy()
  expect(within(card).queryByText('김바다')).toBeNull()
  fireEvent.change(search, { target: { value: '김' } })
  expect(within(card).getAllByRole('listitem')).toHaveLength(50)
  expect(within(card).getByText('50명까지만 보여요')).toBeTruthy()
  fireEvent.change(search, { target: { value: '없는 사람' } })
  expect(within(card).getByText('찾는 사람이 없어요')).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '새 명단 올리기' }))
  const dialog = await screen.findByRole('dialog', { name: '학생회비 납부 명단 올리기' })
  expect(within(dialog).getByText('지금 명단(2026년 2학기 납부자, 54명)을 지우고 새 명단으로 바꿔요.')).toBeTruthy()
  // 대화상자의 X 단추도 이름이 "닫기"다. 어느 쪽이든 닫는다.
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(within(card).getByRole('button', { name: '명단 지우기' }))
  const confirm = await screen.findByRole('dialog', { name: '명단을 지울까요?' })
  api.on('POST', `${base}/dues-roster/delete`, () => json(feeSettings({ roster: null })))
  fireEvent.click(within(confirm).getByRole('button', { name: '지우기' }))
  expect(await screen.findByText('올린 명단이 없어요. 학생회비 납부자 참가비를 쓰려면 명단이 필요해요.')).toBeTruthy()
  expect(api.calls.at(-1)!.body).toEqual({ version: 1 })
  api.assertNoUnexpectedRequests()
})

test('불러오지 못하면 알리고 다시 시도한다', async () => {
  const api = mockApi()
  let fail = true
  api.on('GET', `${base}/fee-settings`, () => fail ? json({ error: 'INTERNAL' }, 500) : json(feeSettings()))
  render(<FeeSettings organizationId="o" />)
  expect(await screen.findByText('참가비 설정을 불러오지 못했어요.')).toBeTruthy()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await region('받는 계좌')).toBeTruthy()
})
