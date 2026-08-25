import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressSteps } from './ProgressSteps'

const ITEMS = [
  { key: 'submitted', label: '요청 제출' },
  { key: 'review', label: '재정부 검토' },
  { key: 'done', label: '처리 완료' },
]

describe('ProgressSteps', () => {
  it('데이터가 가리킨 단계를 현재 단계로 표시한다', () => {
    render(<ProgressSteps items={ITEMS} currentKey="review" />)

    expect(screen.getByText('재정부 검토')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('처리 완료')).not.toHaveAttribute('aria-current')
  })

  it('명세에 없는 단계는 조용히 첫 단계로 바꾸지 않는다', () => {
    expect(() => render(<ProgressSteps items={ITEMS} currentKey="unknown" />)).toThrow(
      /등록되지 않은 현재 단계.*unknown/,
    )
  })
})
