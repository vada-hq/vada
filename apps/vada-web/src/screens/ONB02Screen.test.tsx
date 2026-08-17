import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ONB02Screen } from './ONB02Screen'

describe('ONB02Screen', () => {
  it('화면 카피와 버튼 카피를 스펙에서 렌더한다', () => {
    render(<ONB02Screen onNavigate={() => {}} />)

    expect(
      screen.getByRole('heading', { name: '어떻게 시작하시겠어요?' }),
    ).toBeInTheDocument()
    expect(screen.getByText('참여할 학생회를 선택해 주세요.')).toBeInTheDocument()
    expect(screen.getByText('새로운 학생회를 생성하고 조직을 구성합니다.')).toBeInTheDocument()
    expect(screen.getByText('초대 코드 입력')).toBeInTheDocument()
    expect(
      screen.getByText('초대 링크로 직접 접속한 경우 이 화면을 건너뜁니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('시작 방식 선택 2 / 2')).toBeInTheDocument()
  })

  it('앞으로 가는 버튼은 카드로, 뒤로 가는 버튼은 링크로 동작한다', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<ONB02Screen onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: /새 학생회 만들기/ }))
    expect(onNavigate).toHaveBeenCalledWith('ORG-01')

    await user.click(screen.getByRole('button', { name: /이전으로/ }))
    expect(onNavigate).toHaveBeenCalledWith('ONB-01')
  })
})
