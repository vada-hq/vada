import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('완료한 단계까지 pill을 채우고 단계 라벨을 표시한다', () => {
    render(<AppHeader label="시작 방식 선택" step={2} totalSteps={3} />)

    expect(screen.getByText('시작 방식 선택 2 / 3')).toBeInTheDocument()
    const pills = screen.getByRole('banner').querySelectorAll('span.rounded-full')
    expect(pills).toHaveLength(3)
    expect(pills[0].className).toContain('bg-blue-600')
    expect(pills[1].className).toContain('bg-blue-600')
    expect(pills[2].className).toContain('bg-gray-200')
  })
})
