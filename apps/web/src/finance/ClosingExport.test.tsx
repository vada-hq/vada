// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { downloadFile, saveByFrame } from '@/lib/download'
import { CLOSING_ERRORS, CLOSING_EXPORT_FAILED } from '@/lib/messages'
import { closingFixture } from '@/test-support/closing-fixtures'
import { CURRENT_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { ClosingTab } from './ClosingTab'

vi.mock('@/lib/download', () => ({ downloadFile: vi.fn(), saveByFrame: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.mocked(downloadFile).mockReset()
  vi.mocked(saveByFrame).mockReset()
})

const ORG = '/api/organizations/c1'
const PERIODS = `${ORG}/fiscal-periods`
const CLOSING = `${PERIODS}/${CURRENT_PERIOD}/closing`
const FINANCE = ['closing.export_public', 'closing.export_audit'] as const

function show(closing = closingFixture(), canManage = true) {
  const api = mockApi()
  const periods = standardPeriods()
  periods.periods[0] = { ...periods.periods[0]!, status: closing.status }
  api.on('GET', PERIODS, () => json(periods))
  api.on('GET', CLOSING, () => json({ closing }))
  const openers = { onOpenExpense: vi.fn(), onOpenRequest: vi.fn(), onOpenEvent: vi.fn() }
  render(
    <ClosingTab councilId="c1" canManage={canManage} onForbidden={vi.fn()} openers={openers} />,
  )
}

test('재정부에게는 세 버튼이 있고 공개용 엑셀은 공개용 주소로 받는다', async () => {
  vi.mocked(downloadFile).mockResolvedValue({ ok: true })
  show(closingFixture({ actions: [...FINANCE] }))
  fireEvent.click(await screen.findByRole('button', { name: '공개용 엑셀' }))
  expect(screen.getByRole('button', { name: '감사용 엑셀' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '증빙 묶음 받기' })).toBeTruthy()
  await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1))
  expect(vi.mocked(downloadFile).mock.calls[0]?.[0]).toBe(`${CLOSING}/export?type=public`)
  // 이름이 걸러지지 않는다는 안내가 공개용 옆에 있다.
  expect(screen.getByText(/사람이 직접 쓴 이름은 걸러지지 않아요/)).toBeTruthy()
})

test('공개 뒤 운영진은 공개용 엑셀만 받는다', async () => {
  show(closingFixture({ status: 'published', actions: ['closing.export_public'] }), false)
  await screen.findByRole('button', { name: '공개용 엑셀' })
  expect(screen.queryByRole('button', { name: '감사용 엑셀' })).toBeNull()
  expect(screen.queryByRole('button', { name: '증빙 묶음 받기' })).toBeNull()
})

test('감사용 엑셀은 개인정보 경고를 확인한 뒤에야 받는다', async () => {
  vi.mocked(downloadFile).mockResolvedValue({ ok: true })
  show(closingFixture({ actions: [...FINANCE] }))
  fireEvent.click(await screen.findByRole('button', { name: '감사용 엑셀' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toContain('계좌번호')
  expect(downloadFile).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: '받기' }))
  await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1))
  expect(vi.mocked(downloadFile).mock.calls[0]?.[0]).toBe(`${CLOSING}/export?type=audit`)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('증빙 묶음은 경고를 확인한 뒤 숨은 iframe으로 받고, 받는 동안 버튼이 막힌다', async () => {
  let finish!: (value: { ok: false; code: unknown } | { ok: true }) => void
  vi.mocked(saveByFrame).mockReturnValue(new Promise(done => (finish = done)))
  show(closingFixture({ actions: [...FINANCE] }))
  const bundle = await screen.findByRole('button', { name: '증빙 묶음 받기' })
  fireEvent.click(bundle)
  expect(saveByFrame).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '받기' }))
  await waitFor(() => expect(saveByFrame).toHaveBeenCalledWith(`${CLOSING}/audit.zip`))
  await waitFor(() => expect(bundle).toHaveProperty('disabled', true))
  finish({ ok: true })
  await waitFor(() => expect(bundle).toHaveProperty('disabled', false))
  expect(screen.queryByRole('alert')).toBeNull()
})

test('증빙 묶음이 오류 코드로 거절되면 문구를 버튼 옆에 보인다', async () => {
  vi.mocked(saveByFrame).mockResolvedValue({ ok: false, code: 'EXPORT_TOO_LARGE' })
  show(closingFixture({ actions: [...FINANCE] }))
  fireEvent.click(await screen.findByRole('button', { name: '증빙 묶음 받기' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '받기' }))
  expect((await screen.findByRole('alert')).textContent).toBe(CLOSING_ERRORS.EXPORT_TOO_LARGE)
})

test.each([
  {
    name: '엑셀 상한',
    info: { workbookTooLarge: true },
    off: '감사용 엑셀',
    reason: '엑셀을 받을 수 없어요',
    on: '증빙 묶음 받기',
  },
  {
    name: '묶음 상한',
    info: { bundleTooLarge: true },
    off: '증빙 묶음 받기',
    reason: '묶음을 받을 수 없어요',
    on: '감사용 엑셀',
  },
  {
    name: '저장소 없음',
    info: { bundleAvailable: false },
    off: '증빙 묶음 받기',
    reason: '묶음을 만들 수 없어요',
    on: '감사용 엑셀',
  },
])('$name이면 그 버튼만 꺼지고 이유가 보인다', async ({ info, off, reason, on }) => {
  const closing = closingFixture({ actions: [...FINANCE] })
  show({ ...closing, exportInfo: { ...closing.exportInfo, ...info } })
  expect(await screen.findByRole('button', { name: off })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: on })).toHaveProperty('disabled', false)
  expect(screen.getByText(new RegExp(reason))).toBeTruthy()
})

test('받기가 거절되면 문구를 버튼 옆에 보이고, 받는 동안은 다시 누를 수 없다', async () => {
  let finish!: (value: { ok: false; code: unknown }) => void
  vi.mocked(downloadFile).mockReturnValue(new Promise(done => (finish = done)))
  show(closingFixture({ actions: [...FINANCE] }))
  const button = await screen.findByRole('button', { name: '공개용 엑셀' })
  fireEvent.click(button)
  await waitFor(() => expect(button).toHaveProperty('disabled', true))
  fireEvent.click(button)
  expect(downloadFile).toHaveBeenCalledTimes(1)
  finish({ ok: false, code: 'EXPORT_TOO_LARGE' })
  expect((await screen.findByRole('alert')).textContent).toBe(CLOSING_ERRORS.EXPORT_TOO_LARGE)
  vi.mocked(downloadFile).mockResolvedValue({ ok: false, code: null })
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(CLOSING_EXPORT_FAILED))
})

test('확인을 연 동안 감사용 동작이 서버 동작에서 빠지면 확인을 닫고 알린다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', PERIODS, () => json(standardPeriods()))
  api.on('GET', CLOSING, () => {
    reads += 1
    return json({
      closing: closingFixture({ actions: reads > 1 ? ['closing.export_public'] : [...FINANCE] }),
    })
  })
  render(
    <ClosingTab
      councilId="c1"
      canManage
      onForbidden={vi.fn()}
      openers={{ onOpenExpense: vi.fn(), onOpenRequest: vi.fn(), onOpenEvent: vi.fn() }}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '감사용 엑셀' }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toContain('지금은 할 수 없는 동작')
})
