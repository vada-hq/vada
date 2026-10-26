// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { TaskMobileBoardSection } from './TaskMobileBoardSection'

afterEach(cleanup)

test('390px 견본에서 탭·시작·끝내기가 동작하고 제목으로 상세를 연다', async () => {
  render(<TaskMobileBoardSection />)
  const phone = screen.getByText('390px').parentElement!
  const statusTabs = within(phone).getByRole('tablist', { name: '업무 상태' })
  expect(within(statusTabs).getByRole('tab', { name: '할 일 2' })).toBeTruthy()
  const first = within(phone)
    .getByRole('button', { name: '신입생 환영회 장소 예약' })
    .closest('li')!
  fireEvent.click(within(first).getByRole('button', { name: '시작' }))
  fireEvent.click(within(statusTabs).getByRole('tab', { name: '진행 중 3' }))
  const doing = within(phone)
    .getByRole('button', { name: '신입생 환영회 장소 예약' })
    .closest('li')!
  fireEvent.click(within(doing).getByRole('button', { name: '끝내기' }))
  fireEvent.click(within(statusTabs).getByRole('tab', { name: '끝남 2' }))
  fireEvent.click(within(phone).getByRole('button', { name: '신입생 환영회 장소 예약' }))
  expect(await screen.findByRole('dialog', { name: '신입생 환영회 장소 예약' })).toBeTruthy()
})
