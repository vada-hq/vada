import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('현재 단계 pill만 강조하고 흐름 라벨과 단계 문구를 표시한다', () => {
    render(<AppHeader label="다른 흐름" step={1} totalSteps={3} />)

    expect(screen.getByText('다른 흐름 1 / 3')).toBeInTheDocument()
    const pills = screen.getByRole('banner').querySelectorAll('span.rounded-full')
    expect(pills).toHaveLength(3)
    expect(pills[0].className).toContain('bg-blue-600')
    expect(pills[1].className).toContain('bg-gray-200')
    expect(pills[2].className).toContain('bg-gray-200')
  })
})
