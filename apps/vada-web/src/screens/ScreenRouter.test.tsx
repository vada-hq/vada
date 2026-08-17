import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenRouter } from './ScreenRouter'
import { createEmptyDraft } from '../state/onboarding'

describe('ScreenRouter', () => {
  it('등록되지 않은 screenId는 조용한 대체 없이 명시적 오류를 표시한다', () => {
    render(
      <ScreenRouter
        screenId="ORG-01"
        draft={createEmptyDraft()}
        onChangeDraft={() => {}}
        onNavigate={() => {}}
      />,
    )

    expect(screen.getByText(/구현에 등록되지 않은 화면/)).toBeInTheDocument()
    expect(screen.getByText('ORG-01')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '내 프로필에 표시될 학적 정보를 입력해 주세요' }),
    ).not.toBeInTheDocument()
  })

  it('등록된 화면은 해당 화면을 렌더한다', () => {
    render(
      <ScreenRouter
        screenId="ONB-01"
        draft={createEmptyDraft()}
        onChangeDraft={() => {}}
        onNavigate={() => {}}
      />,
    )

    expect(
      screen.getByRole('heading', { name: '내 프로필에 표시될 학적 정보를 입력해 주세요' }),
    ).toBeInTheDocument()
  })
})
