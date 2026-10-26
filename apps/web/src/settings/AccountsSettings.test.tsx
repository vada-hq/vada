// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetAddress } from '@/test-support/address-reset'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { standardAccounts } from '@/test-support/account-fixtures'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { json, mockApi } from '@/test-support/mock-api'
import CouncilSettings from './CouncilSettings'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

test.each([{ permissions: FINANCE_PERMISSIONS }, { permissions: MEMBER_PERMISSIONS }])(
  '설정의 계좌 탭은 주소로 열리고 수정은 재정 역할만 한다: %j',
  async ({ permissions }) => {
    const api = mockApi()
    api.on('GET', `/api/organizations/${COUNCIL_ID}/accounts`, () => {
      const data = standardAccounts()
      if (!permissions.includes('finance.manage'))
        data.accounts.forEach(account => {
          account.actions = []
        })
      return json(data)
    })
    window.history.replaceState(null, '', `/settings/${COUNCIL_ID}?tab=accounts`)
    render(
      <CouncilSettings
        view={councilView(COUNCIL_ID, { permissions })}
        onSaved={vi.fn()}
        onForbidden={vi.fn()}
      />,
    )
    await screen.findByRole('list', { name: '계좌' })
    expect(screen.getByRole('tab', { name: '계좌' }).getAttribute('aria-selected')).toBe('true')
    expect(Boolean(screen.queryByRole('button', { name: '계좌 더하기' }))).toBe(
      permissions.includes('finance.manage'),
    )
    fireEvent.click(screen.getByRole('tab', { name: '학생회 정보' }))
    expect(await screen.findByRole('form', { name: '학생회 정보' })).toBeTruthy()
  },
)
