import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenRouter } from './ScreenRouter'

describe('ScreenRouter', () => {
  it('등록되지 않은 screenId는 조용한 대체 없이 명시적 오류를 표시한다', () => {
    // 실제 화면 id를 쓰면 그 화면을 구현할 때마다 이 단언이 깨진다.
    // 구현에 절대 등록되지 않을 id로 계약(미등록=명시적 오류)만 검사한다.
    render(
      <ScreenRouter
        screenId="NOT-REGISTERED"
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )

    expect(screen.getByText(/구현에 등록되지 않은 화면/)).toBeInTheDocument()
    expect(screen.getByText('NOT-REGISTERED')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '내 프로필에 표시될 학적 정보를 입력해 주세요' }),
    ).not.toBeInTheDocument()
  })

  it('등록된 화면은 해당 화면을 렌더한다', () => {
    render(
      <ScreenRouter screenId="ONB-01" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )

    expect(
      screen.getByRole('heading', { name: '내 프로필에 표시될 학적 정보를 입력해 주세요' }),
    ).toBeInTheDocument()
  })
})
