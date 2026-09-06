import { describe, expect, it } from 'vitest'
import { josa, topic } from './korean.ts'

// **끝소리가 조사를 정한다.** 한쪽으로 고정하면 문장 절반이 틀린 말이 된다.
describe('조사를 끝소리가 고른다', () => {
  it('받침이 있으면 은, 없으면 는', () => {
    expect(topic('조직도')).toBe('조직도는')
    expect(topic('구성원 초대')).toBe('구성원 초대는')
    expect(topic('회의록')).toBe('회의록은')
    expect(topic('예산 편성')).toBe('예산 편성은')
  })

  it('다른 짝도 같은 규칙이다', () => {
    expect(josa('학생회', '이', '가')).toBe('가')
    expect(josa('구성원', '이', '가')).toBe('이')
  })

  // 가릴 규칙이 없는 것은 지어내지 않는다.
  it('한글로 끝나지 않으면 받침 없는 쪽이다', () => {
    expect(topic('QR')).toBe('QR는')
    // 빈 이름에는 붙일 것이 없다 — 그래도 만들지 않는다.
    expect(josa('', '은', '는')).toBe('는')
  })
})
