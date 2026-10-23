// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Field, MissingHint } from './field'
import { Input } from './input'

afterEach(cleanup)

test('선택 칸은 라벨 옆에 (선택)이 보이고, 입력칸의 이름은 라벨 글 그대로다', () => {
  render(
    <Field label="장소" optional>
      <Input />
    </Field>,
  )
  expect(screen.getByText('(선택)')).toBeTruthy()
  expect(screen.getByLabelText('장소')).toBeTruthy()
})

test('필수 칸은 표시가 없고 입력칸이 필수로 알려진다', () => {
  render(
    <Field label="이름">
      <Input aria-required />
    </Field>,
  )
  expect(screen.queryByText('(선택)')).toBeNull()
  expect(screen.getByLabelText('이름').getAttribute('aria-required')).toBe('true')
})

test('꺼진 버튼이면 빠진 필수 칸을, 빈 칸 없이 꺼졌으면 값을 다시 보라고, 켜져 있으면 아무것도 보이지 않는다', () => {
  const { rerender, container } = render(
    <MissingHint id="hint" missing={['이름', '신청 마감']} blocked />,
  )
  expect(screen.getByText('넣어야 할 칸: 이름, 신청 마감').id).toBe('hint')
  rerender(<MissingHint id="hint" missing={[]} blocked />)
  expect(screen.getByText('입력한 값을 다시 확인해 주세요.')).toBeTruthy()
  rerender(<MissingHint id="hint" missing={[]} blocked={false} />)
  expect(container.textContent).toBe('')
})
