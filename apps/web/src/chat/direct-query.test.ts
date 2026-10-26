import { expect, test } from 'vitest'
import { directMatches, slashQuery } from './direct-query'

test('첫 글자가 /일 때만 이름 찾기이고, 첫 낱말이 찾는 글, 나머지는 옮길 글이다', () => {
  expect(slashQuery('안녕 /이재정')).toBeNull()
  expect(slashQuery('')).toBeNull()
  expect(slashQuery('/')).toEqual({ query: '', rest: '' })
  expect(slashQuery('/이재')).toEqual({ query: '이재', rest: '' })
  expect(slashQuery('/이재정  내일 회의 와요?')).toEqual({
    query: '이재정',
    rest: '내일 회의 와요?',
  })
  expect(slashQuery('/\n둘째 줄')).toEqual({ query: '', rest: '둘째 줄' })
})

test('찾는 글이 든 이름만 나를 빼고 고른다', () => {
  const people = [
    { id: 'm1', name: '김회장' },
    { id: 'm2', name: '이재정' },
    { id: 'm3', name: '박새내' },
  ]
  expect(directMatches(people, '', 'm1').map(person => person.id)).toEqual(['m2', 'm3'])
  expect(directMatches(people, '재정', 'm1').map(person => person.id)).toEqual(['m2'])
  expect(directMatches(people, '회장', 'm1')).toEqual([])
})
