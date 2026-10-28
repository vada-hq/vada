// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { OrganizationTabsSection } from './FeePaymentSections'

afterEach(cleanup)

test('조직 탭 견본은 탭을 바꾸고 유효한 학번·기간으로 바꾸기 확인을 연다', async () => {
  render(<OrganizationTabsSection />)
  fireEvent.click(screen.getByRole('tab', { name: '부서 및 구성원' }))
  expect(screen.queryByLabelText('학번')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: '납부자 명단' }))
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  expect(await screen.findByRole('dialog', { name: '납부자 명단 바꾸기' })).toBeTruthy()
})
