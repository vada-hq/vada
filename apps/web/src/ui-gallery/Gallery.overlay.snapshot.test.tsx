// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import { MyNameSection } from './JoinSections'
import { EventEditSection } from './EventEditSections'
import { CreateCouncilSection } from './OnboardingSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'

// 부품 확인 화면에서 대화상자를 연 모양. 시험마다 그 버튼이 있는 묶음만 그린다(전체 화면은 Gallery.snapshot.test.tsx).
afterEach(cleanup)

const openers: [string, ComponentType][] = [
  ['대화상자 열기', DialogSheetSection],
  ['옆 메뉴 열기', DialogSheetSection],
  ['오른쪽 패널 열기', DialogSheetSection],
  ['확인 대화상자 열기', ConfirmSection],
  ['일반 확인 대화상자 열기', ConfirmSection],
  ['보내는 중 확인 대화상자 열기', ConfirmSection],
  ['코드 바꾸기 확인 창 열기', CreateCouncilSection],
  ['내 이름 창 열기', MyNameSection],
  ['기본정보 수정 패널 열기', EventEditSection],
  ['미정·양식 둘 패널 열기', EventEditSection],
  ['보내는 중 패널 열기', EventEditSection],
  ['저장 실패 패널 열기', EventEditSection],
]

test.each(openers)('%s', (name, Section) => {
  render(<Section />)
  fireEvent.click(screen.getByRole('button', { name }))
  expect(snapshotHtml()).toMatchSnapshot()
})
