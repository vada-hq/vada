import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closingLineLabel } from './closing.js'

test('결산 항목 이름은 행사가 있으면 행사와 항목, 없으면 항목만 표시한다', () => {
  assert.equal(closingLineLabel({ purpose: '식비', eventName: '봄 축제' }), '봄 축제 · 식비')
  assert.equal(closingLineLabel({ purpose: '식비', eventName: '체육대회' }), '체육대회 · 식비')
  assert.equal(closingLineLabel({ purpose: '학생회 운영비', eventName: null }), '학생회 운영비')
})
