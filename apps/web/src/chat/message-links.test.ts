import { expect, test } from 'vitest'
import { bodyParts } from './message-links'

test('본문의 http·https 주소만 링크로 나누고, 끝에 붙은 문장부호는 글로 남긴다', () => {
  expect(bodyParts('여기요: https://a.kr/x?y=1). 그리고 ftp://b.kr')).toEqual([
    { kind: 'text', text: '여기요: ' },
    { kind: 'link', text: 'https://a.kr/x?y=1' },
    { kind: 'text', text: '). 그리고 ftp://b.kr' },
  ])
  expect(bodyParts('주소 없음')).toEqual([{ kind: 'text', text: '주소 없음' }])
})
