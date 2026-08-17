import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ORG01Screen } from './ORG01Screen'
import { createEmptyScopeDraft } from '../state/scopes'
import type { ScopeStore } from '../state/scopes'

const ONBOARDING_SCOPE: ScopeStore = {
  onboardingDraft: {
    values: {
      school: 'sch-001',
      college: 'col-001',
      department: 'dep-001',
      currentGrade: '3',
    },
    labels: {
      school: '한양대학교 ERICA',
      college: '소프트웨어융합대학',
      department: '컴퓨터학부',
      currentGrade: '3학년',
    },
  },
}

function renderScreen(scopes: ScopeStore = {}) {
  const onNavigate = vi.fn()
  render(
    <ORG01Screen
      draft={createEmptyScopeDraft()}
      scopes={scopes}
      onChangeDraft={() => {}}
      onNavigate={onNavigate}
    />,
  )
  return { onNavigate }
}

describe('ORG01Screen', () => {
  it('묶음(group)의 제목·설명을 렌더하고 멤버 필드를 그 안에 담는다', () => {
    renderScreen()

    const group = screen.getByRole('region', { name: '대표 범위' })
    expect(screen.getByText('대표 학교와 단과대학을 선택해 주세요.')).toBeInTheDocument()
    // 멤버는 묶음 안에서만 나온다(바깥 나열에서 중복 렌더되지 않는다).
    expect(group).toContainElement(screen.getByRole('combobox', { name: '학교*' }))
    expect(screen.getAllByRole('combobox', { name: '학교*' })).toHaveLength(1)
  })

  it('presentation: choiceGroup인 select는 선택지를 모두 펼친 버튼으로 그린다', () => {
    renderScreen()

    const options = screen.getAllByRole('radio')
    expect(options.map((option) => option.textContent)).toEqual([
      '총학생회',
      '단과대 학생회',
      '학부·학과 학생회',
      '기타',
    ])
    expect(screen.queryByRole('combobox', { name: '학생회 유형*' })).not.toBeInTheDocument()
  })

  it('스펙의 helperText와 meta.eyebrow를 렌더한다', () => {
    renderScreen()

    expect(screen.getByText('학생회 기록과 구분을 위한 기준 연도입니다.')).toBeInTheDocument()
    expect(screen.getByText('새 학생회 만들기')).toBeInTheDocument()
  })

  it('note는 다른 스코프(onboardingDraft)의 표시 라벨을 separator로 이어 보여준다', () => {
    renderScreen(ONBOARDING_SCOPE)

    expect(
      screen.getByText(
        '내 소속 정보 (참고): 한양대학교 ERICA · 소프트웨어융합대학 · 컴퓨터학부 · 3학년',
      ),
    ).toBeInTheDocument()
  })

  it('note는 값이 없는 참조를 생략하고, 남는 값이 없으면 그리지 않는다', () => {
    render(
      <ORG01Screen
        draft={createEmptyScopeDraft()}
        scopes={{
          onboardingDraft: {
            values: { school: 'sch-001', college: null, department: '', currentGrade: '3' },
            labels: { school: '한양대학교 ERICA', currentGrade: '3학년' },
          },
        }}
        onChangeDraft={() => {}}
        onNavigate={() => {}}
      />,
    )
    expect(screen.getByText('내 소속 정보 (참고): 한양대학교 ERICA · 3학년')).toBeInTheDocument()

    screen.getByText('내 소속 정보 (참고): 한양대학교 ERICA · 3학년').remove()
    renderScreen()
    expect(screen.queryByText(/내 소속 정보/)).not.toBeInTheDocument()
  })

  it('필수값이 비면 주 버튼이 차단되고 첫 누락 필드로 포커스가 간다', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderScreen()

    await user.click(screen.getByRole('button', { name: /다음: 조직 구조 설정/ }))

    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.getAllByText('필수 항목입니다').length).toBeGreaterThan(0)
    // elements 순서상 첫 누락은 orgType(choiceGroup)이므로 그 첫 선택지가 포커스를 받는다.
    expect(screen.getByRole('radio', { name: '총학생회' })).toHaveFocus()
  })

  it('보조 버튼(이전)은 판정 없이 targetScreenId로 이동한다', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderScreen()

    await user.click(screen.getByRole('button', { name: /이전/ }))

    expect(onNavigate).toHaveBeenCalledWith('ONB-02')
  })
})
