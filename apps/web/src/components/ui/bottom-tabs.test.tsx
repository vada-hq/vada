// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { House } from 'lucide-react'
import { afterEach, expect, test } from 'vitest'
import { BottomTabs } from './bottom-tabs'
import { CountBadge } from './count-badge'

afterEach(cleanup)

test('큰 수 배지는 아이콘 오른쪽 모서리부터 놓아 아이콘을 덮지 않는다', () => {
  render(
    <BottomTabs
      items={[
        {
          key: 'home',
          label: '홈',
          icon: House,
          active: true,
          onClick: () => {},
          badge: <CountBadge count={120} label="안 읽은 메시지 120개" />,
        },
      ]}
    />,
  )
  const badge = screen.getByLabelText('안 읽은 메시지 120개')
  expect(badge.parentElement?.classList.contains('left-full')).toBe(true)
  expect(badge.parentElement?.classList.contains('left-3')).toBe(false)
})
