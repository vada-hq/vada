// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { House } from 'lucide-react'
import { afterEach, expect, test } from 'vitest'
import { BottomTabs } from './bottom-tabs'
import { CountBadge } from './count-badge'

afterEach(cleanup)

test('큰 수 배지는 아이콘 오른쪽 위에 조금만 걸치고 360 폭의 다섯 칸 안에 든다', () => {
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
  // 360/5칸 = 72px, 아이콘 20px 가운데면 오른쪽 여유 26px다. 좁힌 '99+'(약 31px)가 6px 걸치면 칸 안에 든다(Chrome 실측).
  const anchor = badge.parentElement!
  for (const name of ['left-full', '-ml-1.5', '*:px-1']) expect(anchor.classList).toContain(name)
  expect(anchor.classList.contains('left-3')).toBe(false)
})
