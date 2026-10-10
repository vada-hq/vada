// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import ApplyPage from './ApplyPage'

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers()
  localStorage.clear()
})
const formPath = '/api/public/registration-forms/ABCD2345'
const token = 'Ab3_-xYz0123456789abcd'
const publicForm = (overrides: Partial<PublicRegistrationForm> = {}): PublicRegistrationForm => ({ organizationName: '소프트웨어융합대학 학생회',
  event: { name: '2026 체육대회', startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: 'ERICA 체육관' },
  notice: '준비물: 운동화\n문의: 학생회실', collectPhone: false, state: 'open', opensAt: null, closesAt: '2026-08-19T23:59', remaining: 58,
  purgeAfter: '2026-09-19', fee: 0, memberFee: null, ...overrides })
function setup(form = publicForm()) {
  const api = mockApi()
  api.on('GET', formPath, () => json(form))
  const onRegistered = vi.fn()
  render(<ApplyPage code="ABCD2345" onRegistered={onRegistered} />)
  return { api, onRegistered }
}
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const submit = () => screen.getByRole('button', { name: '신청하기' })
const heading = () => screen.findByRole('heading', { name: '2026 체육대회' })
function fill({ phone }: { phone?: string } = {}) {
  fireEvent.change(field('이름'), { target: { value: '김바다' } })
  fireEvent.change(field('학번'), { target: { value: '2022-123456' } })
  if (phone !== undefined) fireEvent.change(field('휴대폰 번호'), { target: { value: phone } })
  fireEvent.click(field('개인정보 수집·이용에 동의해요(필수)'))
}

test('받는 중: 행사 정보·안내·남은 자리·개인정보 고지를 보여 주고, 동의해야 신청 버튼이 켜진다', async () => {
  const { api, onRegistered } = setup()
  await heading()
  for (const text of ['소프트웨어융합대학 학생회', '8월 20일 (목) 오전 10:00 ~ 오후 6:00', 'ERICA 체육관', '남은 자리 58', '신청 마감 8월 19일 (수) 오후 11:59',
    '받는 곳: 소프트웨어융합대학 학생회', '항목: 이름, 학번', '보유 기간: 행사가 끝나고 30일 뒤(2026년 9월 19일) 지워요']) {
    expect(screen.getByText(text)).toBeTruthy()
  }
  expect(screen.getByText(/준비물: 운동화/)).toBeTruthy()
  expect(screen.queryByLabelText('휴대폰 번호')).toBeNull()
  fireEvent.change(field('이름'), { target: { value: '김바다' } })
  fireEvent.change(field('학번'), { target: { value: '2022-123456' } })
  expect(submit().hasAttribute('disabled')).toBe(true)
  fireEvent.click(field('개인정보 수집·이용에 동의해요(필수)'))
  expect(submit().hasAttribute('disabled')).toBe(false)
  fireEvent.change(field('학번'), { target: { value: '12345' } })
  expect(submit().hasAttribute('disabled')).toBe(true)
  fireEvent.change(field('학번'), { target: { value: '2022-123456' } })
  api.on('POST', `${formPath}/entries`, () => json({ token }, 201))
  fireEvent.click(submit())
  await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(token))
  expect(api.calls.at(-1)!.body).toEqual({ name: '김바다', studentId: '2022-123456', phone: null, agreed: true })
  expect(localStorage.getItem('vada.registration.ABCD2345')).toBe(token)
  api.assertNoUnexpectedRequests()
})

test('휴대폰 번호를 받는 신청은 번호를 넣어야 버튼이 켜지고, 고지 항목에도 들어간다', async () => {
  const { api } = setup(publicForm({ collectPhone: true, remaining: null }))
  await heading()
  expect(screen.getByText('항목: 이름, 학번, 휴대폰 번호')).toBeTruthy()
  expect(screen.queryByText(/남은 자리/)).toBeNull()
  fill()
  expect(submit().hasAttribute('disabled')).toBe(true)
  fireEvent.change(field('휴대폰 번호'), { target: { value: '010-1234-5678' } })
  expect(submit().hasAttribute('disabled')).toBe(false)
  api.on('POST', `${formPath}/entries`, () => json({ token }, 201))
  fireEvent.click(submit())
  await waitFor(() => expect(api.calls.at(-1)!.body).toEqual({ name: '김바다', studentId: '2022-123456', phone: '010-1234-5678', agreed: true }))
})

test.each([
  ['closed', '신청이 마감됐어요'],
  ['paused', '지금은 신청을 받지 않아요'],
  ['full', '정원이 다 찼어요'],
] as const)('%s: 입력 칸 없이 상태만 알린다', async (state, title) => {
  setup(publicForm({ state }))
  expect(await screen.findByText(title)).toBeTruthy()
  expect(screen.queryByLabelText('이름')).toBeNull()
  expect(screen.queryByRole('button', { name: '신청하기' })).toBeNull()
})

test('시작 전: 시작 시각을 알리고, 그 시각이 되면 다시 불러와 신청 칸을 연다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-01T09:59:50+09:00'))
  const api = mockApi()
  let state: PublicRegistrationForm['state'] = 'upcoming'
  api.on('GET', formPath, () => json(publicForm({ state, opensAt: '2026-08-01T10:00' })))
  render(<ApplyPage code="ABCD2345" onRegistered={() => {}} />)
  expect(await screen.findByText('8월 1일 (토) 오전 10:00부터 신청할 수 있어요.')).toBeTruthy()
  expect(screen.queryByLabelText('이름')).toBeNull()
  state = 'open'
  await vi.advanceTimersByTimeAsync(11_000)
  expect(await screen.findByLabelText('이름')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2)
})

test('이미 신청한 학번이면 알리고, 정원이 찼다는 답이면 알린 뒤 상태를 다시 불러온다', async () => {
  const { api } = setup()
  await heading()
  fill()
  api.on('POST', `${formPath}/entries`, () => json({ error: 'ALREADY_REGISTERED' }, 409))
  fireEvent.click(submit())
  expect(await screen.findByText(/이미 신청한 학번이에요/)).toBeTruthy()
  api.on('POST', `${formPath}/entries`, () => json({ error: 'REGISTRATION_FULL' }, 409))
  api.on('GET', formPath, () => json(publicForm({ state: 'full', remaining: 0 })))
  fireEvent.click(submit())
  expect(await screen.findByText('정원이 다 찼어요')).toBeTruthy()
  expect(screen.queryByLabelText('이름')).toBeNull()
})

test('없는 링크와 연결 실패를 구분해 알리고, 실패는 다시 시도할 수 있다', async () => {
  const api = mockApi()
  api.on('GET', formPath, () => json({ error: 'NOT_FOUND' }, 404))
  render(<ApplyPage code="ABCD2345" onRegistered={() => {}} />)
  expect(await screen.findByText('신청 링크를 찾을 수 없어요. 주소를 다시 확인해 주세요.')).toBeTruthy()
  cleanup()
  api.on('GET', formPath, () => json({ error: 'INTERNAL' }, 500))
  render(<ApplyPage code="ABCD2345" onRegistered={() => {}} />)
  expect(await screen.findByText('신청 정보를 불러오지 못했어요.')).toBeTruthy()
  api.on('GET', formPath, () => json(publicForm()))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await heading()).toBeTruthy()
})

test('이 기기에서 이미 신청했으면 내 신청 보기 링크를 보여 준다', async () => {
  localStorage.setItem('vada.registration.ABCD2345', token)
  setup()
  const link = await screen.findByRole('link', { name: '내 신청 보기' })
  expect(link.getAttribute('href')).toBe(`/r#${token}`)
  expect(screen.getByText('이 기기에서 이미 신청했어요.')).toBeTruthy()
})

test('브라우저 저장소를 쓸 수 없어도 화면과 신청은 그대로 된다', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
  const { api, onRegistered } = setup()
  await heading()
  fill()
  api.on('POST', `${formPath}/entries`, () => json({ token }, 201))
  fireEvent.click(submit())
  await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(token))
})

test('신청 설정이 바뀌었다는 답이면 알리고, 바뀐 설정을 다시 불러와 입력 칸을 맞춘다', async () => {
  const { api } = setup()
  await heading()
  fill()
  api.on('POST', `${formPath}/entries`, () => json({ error: 'FORM_CHANGED' }, 409))
  api.on('GET', formPath, () => json(publicForm({ collectPhone: true })))
  fireEvent.click(submit())
  expect(await screen.findByLabelText('휴대폰 번호')).toBeTruthy()
  expect(screen.getByText('신청 설정이 바뀌었어요. 바뀐 내용을 확인하고 다시 신청해 주세요.')).toBeTruthy()
  expect(field('이름').value).toBe('김바다')
})

test('참가비가 있으면 행사 정보 아래에 적고, 고지에 참가비 확인과 명단 대조를 알린다. 무료면 줄이 없다', async () => {
  setup(publicForm({ fee: 5000, memberFee: 0 }))
  await heading()
  expect(screen.getByText('참가비 5,000원 · 학생회비 납부자 무료')).toBeTruthy()
  expect(screen.getByText('목적: 2026 체육대회 참가 신청 확인, 참가비 확인, 참석 확인과 행사 운영')).toBeTruthy()
  expect(screen.getByText('학생회비 납부 여부는 이름과 학번을 학생회비 명단과 맞춰 확인해요.')).toBeTruthy()
  cleanup()
  setup()
  await heading()
  expect(screen.queryByText(/^참가비 /)).toBeNull()
  expect(screen.getByText('목적: 2026 체육대회 참가 신청 확인, 참석 확인과 행사 운영')).toBeTruthy()
})

test('뒤로 가기로 돌아오면(bfcache) 신청 버튼을 다시 켜고, 기기에 저장한 토큰과 신청 정보를 다시 읽는다', async () => {
  const { api } = setup()
  await heading()
  fill()
  const pending = deferredResponse()
  api.on('POST', `${formPath}/entries`, () => pending.promise)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.getByRole('button', { name: '신청하는 중…' }).hasAttribute('disabled')).toBe(true))
  // 신청이 되어 내 신청 화면으로 넘어갔다가 뒤로 돌아왔다. 기기에는 토큰이 있다.
  localStorage.setItem('vada.registration.ABCD2345', token)
  const gets = api.calls.filter(call => call.method === 'GET').length
  const shown = new Event('pageshow')
  Object.defineProperty(shown, 'persisted', { value: true })
  window.dispatchEvent(shown)
  expect(await screen.findByText('이 기기에서 이미 신청했어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '신청하기' }).hasAttribute('disabled')).toBe(false)
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(gets + 1))
})
