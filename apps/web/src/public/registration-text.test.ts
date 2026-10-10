import { expect, test } from 'vitest'
import { dayText, eventTimeText, formatKoreanTime, privacyNotice, registrationFailure, registrationMessage, stateLabel, stateText } from './registration-text'

test('한국 시각을 요일·오전 오후로 읽는다. 기기 시간대와 상관없다', () => {
  expect(formatKoreanTime('2026-08-20T10:00')).toBe('8월 20일 (목) 오전 10:00')
  expect(formatKoreanTime('2026-08-20T00:05')).toBe('8월 20일 (목) 오전 12:05')
  expect(formatKoreanTime('2026-08-20T12:00')).toBe('8월 20일 (목) 오후 12:00')
  expect(formatKoreanTime('2026-08-23T23:59')).toBe('8월 23일 (일) 오후 11:59')
  expect(dayText('2026-09-19')).toBe('2026년 9월 19일')
})

test('행사 일시: 같은 날 끝나면 끝 시각만, 다른 날이면 두 날짜를 모두 적는다', () => {
  expect(eventTimeText(null, null)).toBeNull()
  expect(eventTimeText('2026-08-20T10:00', null)).toBe('8월 20일 (목) 오전 10:00')
  expect(eventTimeText('2026-08-20T10:00', '2026-08-20T18:00')).toBe('8월 20일 (목) 오전 10:00 ~ 오후 6:00')
  expect(eventTimeText('2026-08-20T10:00', '2026-08-21T12:00')).toBe('8월 20일 (목) 오전 10:00 ~ 8월 21일 (금) 오후 12:00')
})

test('신청 상태: 받는 중이 아니면 제목과 설명을 주고, 시작 전이면 시작 시각을 적는다', () => {
  expect(stateText('open', null)).toBeNull()
  expect(stateText('upcoming', '2026-08-01T10:00')).toEqual({ title: '아직 신청 기간이 아니에요', description: '8월 1일 (토) 오전 10:00부터 신청할 수 있어요.' })
  expect(stateText('closed', null)?.title).toBe('신청이 마감됐어요')
  expect(stateText('full', null)?.title).toBe('정원이 다 찼어요')
  expect(stateText('paused', null)?.title).toBe('지금은 신청을 받지 않아요')
  expect(['open', 'upcoming', 'closed', 'full', 'paused'].map(state => stateLabel(state as never))).toEqual(['받는 중', '시작 전', '마감', '정원 참', '멈춤'])
})

test('오류 문구: 코드마다 할 일을 알려 주고, 모르는 코드는 다시 시도를 권한다', () => {
  expect(registrationMessage('ALREADY_REGISTERED')).toContain('이미 신청한 학번')
  expect(registrationMessage('REGISTRATION_FULL')).toContain('정원')
  expect(registrationMessage('NOT_FOUND')).toContain('찾을 수 없어요')
  expect(registrationMessage('CANCEL_CLOSED')).toContain('문의')
  expect(registrationMessage('DEADLINE_AFTER_EVENT')).toContain('행사가 끝나기 전')
  expect(registrationMessage('SOMETHING_ELSE')).toBe(registrationMessage(undefined))
  expect(registrationFailure).toContain('연결')
})

test('개인정보 고지: 받는 곳·목적·항목·보유 기간·거부권을 적고, 휴대폰 번호는 받을 때만 항목에 넣는다', () => {
  const lines = privacyNotice({ organizationName: '소프트웨어융합대학 학생회', eventName: '체육대회', collectPhone: false, purgeAfter: '2026-09-19' })
  expect(lines).toEqual(['받는 곳: 소프트웨어융합대학 학생회', '목적: 체육대회 참가 신청 확인과 행사 운영', '항목: 이름, 학번',
    '보유 기간: 행사가 끝나고 30일 뒤(2026년 9월 19일) 지워요', '동의하지 않을 수 있어요. 다만 동의하지 않으면 신청할 수 없어요.'])
  expect(privacyNotice({ organizationName: 'A', eventName: 'B', collectPhone: true, purgeAfter: '2026-09-19' })[2]).toBe('항목: 이름, 학번, 휴대폰 번호')
})
