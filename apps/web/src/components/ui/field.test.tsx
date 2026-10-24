// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Field } from './field'
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

test('필수 칸은 별표가 보이고 입력칸이 필수로 알려진다', () => {
  render(
    <Field label="이름" required>
      <Input />
    </Field>,
  )
  expect(screen.queryByText('(선택)')).toBeNull()
  expect(screen.getByText('*')).toBeTruthy()
  expect(screen.getByLabelText('이름').getAttribute('aria-required')).toBe('true')
})

test('도움말과 문제는 칸에 이어져 읽히고, 문제가 있으면 칸이 틀렸다고 알려진다', () => {
  render(
    <Field label="학번" required hint="줄바꿈이나 쉼표로 구분" error="학번을 입력해 주세요">
      <Input />
    </Field>,
  )
  const input = screen.getByLabelText('학번')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  const described = (input.getAttribute('aria-describedby') ?? '').split(' ')
  const texts = described.map(id => document.getElementById(id)?.textContent)
  expect(texts).toEqual(['줄바꿈이나 쉼표로 구분', '학번을 입력해 주세요'])
})
