import { describe, expect, it } from 'vitest'
import { clock, daysBetween, dottedStamp, moment, shortStamp, stamp } from './time.ts'

// **기계의 시간대에 기대지 않는다는 것을 여기서 잰다.**
//
// 오랫동안 `at.getHours()`로 찍었다. 내 기계는 한국이라 검사가 통과했고, CI가
// UTC로 돌자 네 검사가 한꺼번에 깨졌다(2026-09-01) — 배포했으면 아무 오류 없이
// 모든 시각이 아홉 시간 어긋난 채 보였을 것이다.
//
// 그래서 **절대 시각**(`Z`)을 주고 한국 시각이 나오는지 본다. 이 검사는 어느 기계에서
// 돌든 같은 답이어야 하고, 그것이 이 모듈이 존재하는 이유다.

const TEN_AM_KST = new Date('2026-08-20T01:00:00Z')

describe('때를 글로 만든다', () => {
  it('한국 시각으로 찍는다', () => {
    expect(stamp(TEN_AM_KST)).toBe('2026. 08. 20 10:00')
    expect(moment(TEN_AM_KST)).toBe('2026-08-20 10:00')
    expect(shortStamp(TEN_AM_KST)).toBe('08.20 10:00')
    expect(clock(TEN_AM_KST)).toBe('10:00')
    expect(dottedStamp(TEN_AM_KST)).toBe('2026.08.20 10:00')
  })

  // **날짜가 넘어가는 자리가 가장 위험하다.** UTC로는 전날인 시각이다.
  it('한국의 새벽은 UTC의 전날이지만 한국 날짜로 찍는다', () => {
    expect(stamp(new Date('2026-08-19T21:00:00Z'))).toBe('2026. 08. 20 06:00')
  })

  // 자정을 24시로 내는 구현이 있다. 하루가 바뀌는 자리라 그대로 두면 '24:30'이 나온다.
  it('자정은 24시가 아니라 00시다', () => {
    expect(clock(new Date('2026-08-19T15:00:00Z'))).toBe('00:00')
    expect(stamp(new Date('2026-08-19T15:30:00Z'))).toBe('2026. 08. 20 00:30')
  })
})

describe('날 수를 센다', () => {
  // '어제'는 스물네 시간 전이 아니라 하루 전 날짜다.
  it('시각이 아니라 날짜로 센다', () => {
    const lateNight = new Date('2026-08-19T14:00:00Z') // 한국 8/19 23:00
    const earlyMorning = new Date('2026-08-19T22:00:00Z') // 한국 8/20 07:00
    // 여덟 시간 차이지만 날짜는 하루 차이다.
    expect(daysBetween(lateNight, earlyMorning)).toBe(1)
  })

  it('같은 날은 0이다', () => {
    expect(daysBetween(new Date('2026-08-19T22:00:00Z'), new Date('2026-08-20T10:00:00Z'))).toBe(0)
  })

  it('거꾸로도 센다', () => {
    expect(daysBetween(new Date('2026-08-25T01:00:00Z'), new Date('2026-08-20T01:00:00Z'))).toBe(-5)
  })
})
