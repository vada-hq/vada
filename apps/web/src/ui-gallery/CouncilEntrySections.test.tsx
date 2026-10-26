// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CouncilEntrySection } from './CouncilEntrySections'

afterEach(cleanup)

test.each(['초대 코드로 들어가기', '학생회 만들기'])(
  '1280·390 견본의 %s 길과 닫기가 동작한다',
  async label => {
    render(<CouncilEntrySection />)
    fireEvent.keyDown(screen.getAllByRole('button', { name: /학생회 메뉴$/ })[0]!, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: '총학생회 다른대학교' })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('menuitem', { name: label }))
    if (label === '학생회 만들기')
      expect(screen.getByRole('heading', { name: '기본 정보' })).toBeTruthy()
    else expect(screen.getByRole('textbox', { name: '초대 코드' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.getAllByRole('button', { name: /학생회 메뉴$/ })).toHaveLength(2)
  },
)
