import { expect, test } from 'vitest'
import { moveCell, settleCell } from './grid-nav'

const ids = ['a', 'b', 'c']

test('화살표는 한 칸 가고 가장자리에서 멈춘다', () => {
  expect(moveCell({ ids, cols: 3 }, { id: 'b', col: 1 }, 'ArrowDown', false)).toEqual({
    id: 'c',
    col: 1,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'c', col: 1 }, 'ArrowDown', false)).toEqual({
    id: 'c',
    col: 1,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'a', col: 0 }, 'ArrowUp', false)).toEqual({
    id: 'a',
    col: 0,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'a', col: 0 }, 'ArrowLeft', false)).toEqual({
    id: 'a',
    col: 0,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'a', col: 2 }, 'ArrowRight', false)).toEqual({
    id: 'a',
    col: 2,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'a', col: 0 }, 'ArrowRight', false)).toEqual({
    id: 'a',
    col: 1,
  })
})

test('Home·End는 줄의 처음·끝, Ctrl을 더하면 표의 처음·끝 칸이다', () => {
  expect(moveCell({ ids, cols: 3 }, { id: 'b', col: 1 }, 'Home', false)).toEqual({
    id: 'b',
    col: 0,
  })
  expect(moveCell({ ids, cols: 3 }, { id: 'b', col: 1 }, 'End', false)).toEqual({ id: 'b', col: 2 })
  expect(moveCell({ ids, cols: 3 }, { id: 'b', col: 1 }, 'Home', true)).toEqual({ id: 'a', col: 0 })
  expect(moveCell({ ids, cols: 3 }, { id: 'b', col: 1 }, 'End', true)).toEqual({ id: 'c', col: 2 })
})

test('다시 읽은 뒤 초점: 있으면 그대로, 빠지면 뒤의 업무, 뒤가 없으면 마지막, 비면 없음', () => {
  expect(settleCell(null, [], ids)).toEqual({ id: 'a', col: 0 })
  expect(settleCell({ id: 'b', col: 2 }, ids, ['c', 'b', 'a'])).toEqual({ id: 'b', col: 2 })
  expect(settleCell({ id: 'b', col: 2 }, ids, ['a', 'c'])).toEqual({ id: 'c', col: 2 })
  expect(settleCell({ id: 'c', col: 2 }, ids, ['a', 'b'])).toEqual({ id: 'b', col: 2 })
  expect(settleCell({ id: 'c', col: 2 }, ids, [])).toBeNull()
})
