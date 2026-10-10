// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyRegistration } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import MyRegistrationPage from './MyRegistrationPage'

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  localStorage.clear()
})
const token = 'Ab3_-xYz0123456789abcd'
const lookupPath = '/api/public/registrations/lookup'
const cancelPath = '/api/public/registrations/cancel'
const mine = (overrides: Partial<MyRegistration> = {}): MyRegistration => ({ code: 'ABCD2345', organizationName: '소프트웨어융합대학 학생회',
  event: { name: '2026 체육대회', startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: 'ERICA 체육관' }, name: '김바다',
  studentId: '2022123456', phone: '01012345678', createdAt: '2026-08-02T14:05', closesAt: '2026-08-19T23:59', cancelled: false, cancellable: true,
  ...overrides })
function setup(registration: MyRegistration | Response = mine()) {
  const api = mockApi()
  api.on('POST', lookupPath, () => registration instanceof Response ? registration : json(registration))
  render(<MyRegistrationPage token={token} />)
  return api
}

test('토큰으로 신청 내용을 보여 주고, 주소를 저장하라고 알리며 복사할 수 있다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const api = setup()
  expect(await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })).toBeTruthy()
  expect(api.calls[0]!.body).toEqual({ token })
  for (const text of ['2026 체육대회', '8월 20일 (목) 오전 10:00 ~ 오후 6:00', 'ERICA 체육관', '김바다', '2022123456', '010-1234-5678',
    '8월 2일 (일) 오후 2:05', '소프트웨어융합대학 학생회']) expect(screen.getByText(text)).toBeTruthy()
  expect(screen.getByText('이 화면 주소를 저장해 두세요. 신청을 확인하고 취소할 때 필요해요.')).toBeTruthy()
  expect(screen.getByText('8월 19일 (수) 오후 11:59까지 취소할 수 있어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href))
  expect(await screen.findByText('주소를 복사했어요.')).toBeTruthy()
})

test('마감 전에는 확인을 받고 취소하며, 취소하면 정보가 사라지고 기기에 저장한 토큰도 지운다', async () => {
  localStorage.setItem('vada.registration.ABCD2345', token)
  const api = setup(mine({ phone: null }))
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json(mine({ name: null, studentId: null, phone: null, cancelled: true, cancellable: false })))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByRole('heading', { name: '신청을 취소했어요' })).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: cancelPath, body: { token } })
  expect(screen.queryByText('김바다')).toBeNull()
  expect(localStorage.getItem('vada.registration.ABCD2345')).toBeNull()
})

test('취소가 막히면 이유를 알리고, 마감 뒤에는 취소 버튼 대신 문의를 안내한다', async () => {
  const api = setup()
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json({ error: 'CANCEL_CLOSED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByText('마감 뒤에는 취소할 수 없어요. 학생회에 문의해 주세요.')).toBeTruthy()
  cleanup()
  setup(mine({ cancellable: false }))
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  expect(screen.getByText('마감 뒤에 취소하려면 학생회에 문의해 주세요.')).toBeTruthy()
})

test('토큰이 없거나 찾을 수 없으면 알리고, 연결이 안 되면 다시 시도할 수 있다', async () => {
  render(<MyRegistrationPage token={null} />)
  const missing = '신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요.'
  expect(screen.getByText(missing)).toBeTruthy()
  cleanup()
  setup(json({ error: 'NOT_FOUND' }, 404))
  expect(await screen.findByText(missing)).toBeTruthy()
  cleanup()
  const api = setup(json({ error: 'INTERNAL' }, 500))
  expect(await screen.findByText('신청 정보를 불러오지 못했어요.')).toBeTruthy()
  api.on('POST', lookupPath, () => json(mine()))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })).toBeTruthy()
})

test('브라우저 저장소를 쓸 수 없어도 보기와 취소가 된다', async () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
  const api = setup()
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json(mine({ name: null, studentId: null, phone: null, cancelled: true, cancellable: false })))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByRole('heading', { name: '신청을 취소했어요' })).toBeTruthy()
})
