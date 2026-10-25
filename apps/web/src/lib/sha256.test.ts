import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { sha256Hex } from './sha256'

const reference = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

test('알려진 값과 같다', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
})

test('블록 경계(55, 56, 63, 64, 65바이트)와 한글에서도 node의 값과 같다', () => {
  for (const length of [1, 55, 56, 63, 64, 65, 119, 120, 200]) {
    const text = 'a'.repeat(length)
    expect(sha256Hex(text)).toBe(reference(text))
  }
  expect(sha256Hex('김새내 20260001')).toBe(reference('김새내 20260001'))
})
