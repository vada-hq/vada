// @vitest-environment node
import { expect, test } from 'vitest'
import { visibleSquare } from './qr-reader'

test('판독은 카메라 화면(정사각형, object-cover)에 보이는 가운데 정사각형만 읽는다', () => {
  expect(visibleSquare(1280, 720)).toEqual({ x: 280, y: 0, side: 720 })
  expect(visibleSquare(720, 1280)).toEqual({ x: 0, y: 280, side: 720 })
  expect(visibleSquare(640, 640)).toEqual({ x: 0, y: 0, side: 640 })
  expect(visibleSquare(641, 480)).toEqual({ x: 81, y: 0, side: 480 })
})
