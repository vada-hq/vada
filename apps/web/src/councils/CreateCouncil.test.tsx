// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { myCouncil } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import CreateCouncilForm from './CreateCouncilForm'

// 학생회 만들기 단계(기능 020 조각 3): 기본 정보 1/3 → 조직 구조 2/3 → 초대 링크 3/3.
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T03:00:00Z'))
  api = mockApi()
})
afterEach(() => {
  cleanup()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})

function serve(linkedName: string | null = null) {
  api.on('GET', '/api/me/profile', () => json({ name: linkedName }))
  api.on('GET', '/api/organizations/c9/invite', () => json({ code: 'ABCD2345' }))
}
function open(props: { onCreated?: () => void; onCancel?: () => void } = {}) {
  render(
    <CreateCouncilForm
      userName="김구글"
      onCreated={props.onCreated ?? (() => {})}
      onCancel={props.onCancel ?? (() => {})}
    />,
  )
  return screen.getByRole('form', { name: '학생회 만들기' })
}
const form = () => screen.getByRole('form', { name: '학생회 만들기' })
const button = (name: string) => within(form()).getByRole('button', { name })
function fillBasic() {
  fireEvent.change(screen.getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '컴퓨터학부 학생회' } })
}
async function toStructure() {
  fillBasic()
  fireEvent.click(button('다음'))
  await screen.findByText('조직 구조 2/3')
}
const departmentInputs = () =>
  screen.getAllByLabelText('부서 이름').map(input => asElement(input, HTMLInputElement))
const postBody = () => api.calls.find(call => call.method === 'POST')?.body

test('1단계에는 유형 세로 라디오 셋(기본 학부·학과), 학교, 학생회 이름, 운영 연도가 있다', () => {
  serve()
  open()
  expect(screen.getByText('기본 정보 1/3')).toBeTruthy()
  const group = screen.getByRole('group', { name: '학생회 유형' })
  const radios = within(group).getAllByRole('radio') as HTMLInputElement[]
  expect(radios.map(radio => radio.labels?.[0]?.textContent)).toEqual([
    '총학생회',
    '단과대 학생회',
    '학부·학과 학생회',
  ])
  expect(radios.find(radio => radio.checked)?.value).toBe('department')
  const labels = within(form())
    .getAllByText(/^(학생회 유형|학교|학생회 이름|운영 연도)$/)
    .map(node => node.textContent)
  expect(labels).toEqual(['학생회 유형', '학교', '학생회 이름', '운영 연도'])
  expect(asElement(screen.getByLabelText('운영 연도'), HTMLSelectElement).value).toBe('2026')
})

test('1단계 [다음]은 누를 때 확인해 칸 아래에 알리고 첫 칸으로 옮기며, [취소]는 처음 화면으로', async () => {
  serve()
  const onCancel = vi.fn()
  open({ onCancel })
  fireEvent.click(button('다음'))
  expect(screen.getByText('학교를 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('학생회 이름을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('학교')))
  expect(screen.queryByText('조직 구조 2/3')).toBeNull()
  fireEvent.click(button('취소'))
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('2단계 회장단 카드는 이어진 운영진이 없으면 Google 이름이 든 내 이름 칸, 있으면 이름이다', async () => {
  serve()
  open()
  await toStructure()
  const name = asElement(await screen.findByLabelText('내 이름'), HTMLInputElement)
  expect(name.value).toBe('김구글')
  cleanup()
  api = mockApi()
  serve('김회장')
  open()
  await toStructure()
  const card = screen.getByRole('region', { name: '회장단' })
  expect(await within(card).findByText('김회장')).toBeTruthy()
  expect(screen.queryByLabelText('내 이름')).toBeNull()
})

test('2단계 부서 목록: 재정부(뺄 수 없음)와 기획부·홍보부, 더하기 단추, 빼기·더하기·고치기', async () => {
  serve()
  open()
  await toStructure()
  const finance = asElement(screen.getByLabelText('재정 부서 이름'), HTMLInputElement)
  expect(finance.value).toBe('재정부')
  expect(screen.getByText('재정')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '재정부 빼기' })).toBeNull()
  expect(departmentInputs().map(input => input.value)).toEqual(['기획부', '홍보부'])
  for (const name of ['복지부', '문화부', '체육부', '학술부']) expect(button(name)).toBeTruthy()
  fireEvent.click(button('기획부 빼기'))
  fireEvent.click(button('복지부'))
  expect(within(form()).queryByRole('button', { name: '복지부' })).toBeNull()
  fireEvent.click(button('부서 추가'))
  const added = departmentInputs().at(-1)!
  expect(added.value).toBe('')
  await waitFor(() => expect(document.activeElement).toBe(added))
  fireEvent.change(added, { target: { value: '디자인부' } })
  fireEvent.change(departmentInputs()[0]!, { target: { value: '홍보국' } })
  expect(departmentInputs().map(input => input.value)).toEqual(['홍보국', '복지부', '디자인부'])
})

test('2단계는 같은 이름과 빈 이름을 그 줄 아래에 알리고 보내지 않는다', async () => {
  serve()
  open()
  await toStructure()
  fireEvent.change(departmentInputs()[1]!, { target: { value: ' 기획부 ' } })
  fireEvent.click(button('부서 추가'))
  fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: ' ' } })
  fireEvent.click(button('학생회 만들기'))
  const [, second, third] = departmentInputs()
  expect(second!.getAttribute('aria-invalid')).toBe('true')
  expect(third!.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByText('같은 이름의 부서가 있어요')).toBeTruthy()
  expect(screen.getByText('부서 이름을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('내 이름')))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('[이전]은 1단계 값을 그대로 보이고, 다시 오면 부서 목록도 남아 있다', async () => {
  serve()
  open()
  fireEvent.click(screen.getByRole('radio', { name: '단과대 학생회' }))
  fireEvent.change(screen.getByLabelText('운영 연도'), { target: { value: '2027' } })
  await toStructure()
  fireEvent.click(button('홍보부 빼기'))
  fireEvent.click(button('이전'))
  expect(screen.getByText('기본 정보 1/3')).toBeTruthy()
  expect(asElement(screen.getByLabelText('학교'), HTMLInputElement).value).toBe('한양대학교 ERICA')
  expect(asElement(screen.getByLabelText('학생회 이름'), HTMLInputElement).value).toBe(
    '컴퓨터학부 학생회',
  )
  expect(
    asElement(screen.getByRole('radio', { name: '단과대 학생회' }), HTMLInputElement).checked,
  ).toBe(true)
  expect(asElement(screen.getByLabelText('운영 연도'), HTMLSelectElement).value).toBe('2027')
  fireEvent.click(button('다음'))
  expect(departmentInputs().map(input => input.value)).toEqual(['기획부'])
})

test('[학생회 만들기]는 보내는 동안 busy이고 두 번 가지 않으며, 성공하면 초대 링크 단계에서 복사하고 홈으로 간다', async () => {
  serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/create', () => pending.promise)
  const writeText = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const onCreated = vi.fn()
  open({ onCreated })
  await toStructure()
  fireEvent.click(button('기획부 빼기'))
  fireEvent.click(button('학술부'))
  fireEvent.change(screen.getByLabelText('재정 부서 이름'), { target: { value: '총무부' } })
  fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: '김회장 ' } })
  fireEvent.click(button('학생회 만들기'))
  const sending = asElement(button('만드는 중…'), HTMLButtonElement)
  expect(sending.getAttribute('aria-busy')).toBe('true')
  fireEvent.click(sending)
  fireEvent.submit(form())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(postBody()).toEqual({
    name: '컴퓨터학부 학생회',
    unit: 'department',
    schoolName: '한양대학교 ERICA',
    year: 2026,
    financeDepartmentName: '총무부',
    departments: ['홍보부', '학술부'],
    memberName: '김회장',
  })
  pending.resolve(json({ council: myCouncil('c9') }, 201))
  expect(await screen.findByText('초대 링크 3/3')).toBeTruthy()
  const link = asElement(
    await screen.findByRole('textbox', { name: '초대 링크' }),
    HTMLInputElement,
  )
  expect(link.value).toBe(`${window.location.origin}/join/ABCD2345`)
  expect(screen.queryByRole('button', { name: '이전' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '링크 복사' }))
  expect(await screen.findByText('초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith(link.value)
  expect(onCreated).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '홈으로' }))
  expect(onCreated).toHaveBeenCalledWith(myCouncil('c9'))
})

test('이어진 운영진이면 내 이름을 보내지 않는다', async () => {
  serve('김회장')
  api.on('POST', '/api/organizations/create', () => deferredResponse().promise)
  open()
  await toStructure()
  await screen.findByText('김회장')
  fireEvent.click(button('학생회 만들기'))
  await waitFor(() => expect(postBody()).toBeTruthy())
  expect(postBody()).not.toHaveProperty('memberName')
})

test('만들지 못하면(409) 그 까닭을 버튼 옆에 보이고 2단계에 남는다', async () => {
  serve()
  api.on('POST', '/api/organizations/create', () => json({ error: 'EMAIL_IN_USE' }, 409))
  open()
  await toStructure()
  fireEvent.click(button('학생회 만들기'))
  const message = await within(form()).findByText(/이메일을 다른 계정이 쓰고 있어요/)
  expect(message.parentElement?.contains(button('학생회 만들기'))).toBe(true)
  expect(screen.getByText('조직 구조 2/3')).toBeTruthy()
  expect(asElement(button('학생회 만들기'), HTMLButtonElement).disabled).toBe(false)
})

test('2단계에서 해가 바뀌어 운영 연도가 선택지 밖이면 보내지 않고 1단계의 그 칸 아래에 알린다', async () => {
  serve()
  open()
  fireEvent.change(screen.getByLabelText('운영 연도'), { target: { value: '2025' } })
  await toStructure()
  vi.setSystemTime(new Date('2026-12-31T15:00:00Z'))
  fireEvent.click(button('학생회 만들기'))
  expect(await screen.findByText('운영 연도를 다시 골라 주세요')).toBeTruthy()
  expect(screen.getByText('기본 정보 1/3')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('부서는 재정 부서를 더해 20개가 되면 더하기 단추가 없다', async () => {
  serve()
  open()
  await toStructure()
  for (const name of ['복지부', '문화부', '체육부', '학술부']) fireEvent.click(button(name))
  for (let index = 0; index < 13; index++) fireEvent.click(button('부서 추가'))
  expect(departmentInputs()).toHaveLength(19)
  expect(within(form()).queryByRole('button', { name: '부서 추가' })).toBeNull()
})
