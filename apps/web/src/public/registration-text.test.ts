import { expect, test } from 'vitest'
import { dayText, depositorName, eventTimeText, feeLine, formatKoreanTime, phoneText, privacyNotice, registrationFailure, registrationMessage, stateLabel,
  stateText } from './registration-text'

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
  const lines = privacyNotice({ organizationName: '소프트웨어융합대학 학생회', eventName: '체육대회', collectPhone: false, purgeAfter: '2026-09-19',
    fee: 0, memberFee: null })
  expect(lines).toEqual(['받는 곳: 소프트웨어융합대학 학생회', '목적: 체육대회 참가 신청 확인, 참석 확인과 행사 운영', '항목: 이름, 학번',
    '보유 기간: 행사가 끝나고 30일 뒤(2026년 9월 19일) 지워요', '동의하지 않을 수 있어요. 다만 동의하지 않으면 신청할 수 없어요.'])
  expect(privacyNotice({ organizationName: 'A', eventName: 'B', collectPhone: true, purgeAfter: '2026-09-19', fee: 0, memberFee: null })[2])
    .toBe('항목: 이름, 학번, 휴대폰 번호')
})

test('휴대폰 번호: 11자리는 3-4-4, 10자리는 3-3-4로 끊는다', () => {
  expect(phoneText('01012345678')).toBe('010-1234-5678')
  expect(phoneText('0112345678')).toBe('011-234-5678')
})

test('개인정보 고지: 참가비가 있으면 목적에 참가비 확인을 넣고, 납부자 참가비가 있으면 명단과 맞춰 본다고 알린다', () => {
  const base = { organizationName: 'A', eventName: '체육대회', collectPhone: false, purgeAfter: '2026-09-19' }
  const dues = '학생회비 납부 여부는 이름과 학번을 학생회비 명단과 맞춰 확인해요.'
  const member = privacyNotice({ ...base, fee: 5000, memberFee: 0 })
  expect(member[1]).toBe('목적: 체육대회 참가 신청 확인, 참가비 확인, 참석 확인과 행사 운영')
  expect(member[3]).toBe(dues)
  const flat = privacyNotice({ ...base, fee: 5000, memberFee: null })
  expect(flat[1]).toBe('목적: 체육대회 참가 신청 확인, 참가비 확인, 참석 확인과 행사 운영')
  expect(flat).not.toContain(dues)
})

test('참가비 줄: 무료면 없고, 정액이나 학생회비 납부자 금액을 적는다', () => {
  expect(feeLine(0, null)).toBeNull()
  expect(feeLine(5000, null)).toBe('참가비 5,000원')
  expect(feeLine(5000, 0)).toBe('참가비 5,000원 · 학생회비 납부자 무료')
  expect(feeLine(5000, 2000)).toBe('참가비 5,000원 · 학생회비 납부자 2,000원')
})

test('입금자명은 이름에 학번 뒤 4자리를 붙인다', () => {
  expect(depositorName('김바다', '2022123456')).toBe('김바다3456')
  expect(depositorName('Kim Bada', '202212')).toBe('Kim Bada2212')
})
