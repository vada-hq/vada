import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appPath, parseAppPath } from './paths.js'

const C = '0199d1a0-0000-7000-8000-00000000000a'
test('구매 요청 작성은 새로고침 가능한 주소이고 본문을 쿼리에 받지 않는다', () => {
  const path = `/finance/${C}/requests/new`
  const location = parseAppPath(`${path}?body=private`)
  assert.deepEqual(location, {
    type: 'menu',
    menu: 'finance',
    councilId: C,
    query: { compose: 'new' },
  })
  assert.equal(location && appPath(location), path)
  assert.deepEqual(parseAppPath(`/finance/${C}?compose=new&tab=expenses&body=private`), location)
  assert.equal(parseAppPath(`/finance/${C}/requests/nope`), null)
})
