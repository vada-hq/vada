import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('현재 단계 pill만 강조하고 단계 문구를 표시한다', () => {
    render(<AppHeader step={2} totalSteps={2} />)

    expect(screen.getByText('기본 설정 2 / 2')).toBeInTheDocument()
    const pills = screen.getByRole('banner').querySelectorAll('span.rounded-full')
    expect(pills).toHaveLength(2)
    expect(pills[0].className).toContain('bg-gray-200')
    expect(pills[1].className).toContain('bg-blue-600')
  })
})
