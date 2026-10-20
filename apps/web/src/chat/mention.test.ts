import { expect, test } from 'vitest'
import { insertMention, mentionIds, mentionQuery, suggestions } from './mention'

test('@ 뒤 글자를 찾는다. 단어 가운데의 @는 부르기가 아니다', () => {
  expect(mentionQuery('안녕 @이', 5)).toEqual({ start: 3, query: '이' })
  expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' })
  expect(mentionQuery('a@b', 3)).toBeNull()
  expect(mentionQuery('@이재정 안녕', 8)).toBeNull()
  expect(mentionQuery('안녕', 2)).toBeNull()
})

test('고르면 "@이름 "이 들어가고 커서가 그 뒤로 간다', () => {
  expect(insertMention('안녕 @이 끝', 5, '이재정')).toEqual({
    text: '안녕 @이재정  끝',
    caret: 8,
  })
})

test('본문에서 지운 이름은 부르지 않고, 같은 사람은 한 번만 낸다', () => {
  const picks = [
    { memberId: 'm1', name: '김회장' },
    { memberId: 'm2', name: '이재정' },
  ]
  expect(mentionIds('@김회장 @김회장 확인', picks)).toEqual(['m1'])
  expect(mentionIds('확인', picks)).toEqual([])
})

test('목록은 이름으로 거르고 나는 뺀다', () => {
  const people = [
    { memberId: 'm1', name: '김회장' },
    { memberId: 'm2', name: '이재정' },
  ]
  expect(suggestions(people, '이', 'm1')).toEqual([people[1]])
  expect(suggestions(people, '', 'm1')).toEqual([people[1]])
})
