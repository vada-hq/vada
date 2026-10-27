import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateFromKorean } from '@vada/contracts'
import { changeNoticeOf, createdNoticeOf } from './change-notice.js'

// 한국 시각 2026-10-25 12:00
const NOW = new Date('2026-10-25T03:00:00Z')
const at = (value: string) => dateFromKorean(value)
const BEFORE = {
  name: '가을 축제',
  startsAt: at('2026-11-05T14:00'),
  endsAt: at('2026-11-05T18:00'),
  place: '대운동장',
}

test('장소만 바뀌면 한 줄이고, 행사 이름과 이전 → 새 값이다', () => {
  assert.equal(
    changeNoticeOf(BEFORE, { ...BEFORE, place: '체육관' }, NOW),
    '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
  )
})

test('일시와 장소를 함께 바꾸면 글 하나에 두 줄이다. 시작과 끝은 일시 한 줄이고 같은 날의 끝은 시각만 쓴다', () => {
  const after = {
    ...BEFORE,
    startsAt: at('2026-11-06T10:00'),
    endsAt: at('2026-11-06T12:30'),
    place: '체육관',
  }
  assert.equal(
    changeNoticeOf(BEFORE, after, NOW),
    [
      '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 ~ 18:00 → 11월 6일 (금) 10:00 ~ 12:30',
      '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
    ].join('\n'),
  )
})

test('끝만 바뀌어도 일시 줄이다. 다른 날에 끝나면 끝에도 날짜를, 올해가 아니면 연도를 쓴다', () => {
  assert.equal(
    changeNoticeOf(BEFORE, { ...BEFORE, endsAt: at('2027-01-02T09:00') }, NOW),
    '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 ~ 18:00 → 11월 5일 (목) 14:00 ~ 2027년 1월 2일 (토) 09:00',
  )
})

test('처음 정하거나(미정 → 값) 비우면(값 → 미정) 글이 없다. 전부는 행사 이력에 남는다(DEC-80)', () => {
  const empty = { name: '뒤풀이', startsAt: null, endsAt: null, place: null }
  assert.equal(
    changeNoticeOf(empty, { ...empty, startsAt: at('2026-11-05T19:00'), place: '학생회실' }, NOW),
    null,
  )
  assert.equal(
    changeNoticeOf(BEFORE, { ...BEFORE, startsAt: null, endsAt: null, place: null }, NOW),
    null,
  )
})

test('끝 시각만 비워도 일시는 정해진 채라 일시 줄이다. 장소를 비운 것은 줄이 없다', () => {
  assert.equal(
    changeNoticeOf(BEFORE, { ...BEFORE, endsAt: null, place: null }, NOW),
    '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 ~ 18:00 → 11월 5일 (목) 14:00',
  )
})

test('이름만 바뀌면 글이 없고, 이름과 장소가 바뀌면 장소 줄만 새 이름으로 부른다', () => {
  assert.equal(changeNoticeOf(BEFORE, { ...BEFORE, name: '가을 체육대회' }, NOW), null)
  assert.equal(
    changeNoticeOf(BEFORE, { ...BEFORE, name: '가을 체육대회', place: '체육관' }, NOW),
    '가을 체육대회 장소가 바뀌었어요 · 대운동장 → 체육관',
  )
})

test('같은 값이면 글이 없다(같은 순간을 다른 Date로 받아도)', () => {
  const same = {
    ...BEFORE,
    startsAt: new Date(BEFORE.startsAt.getTime()),
    endsAt: new Date(BEFORE.endsAt.getTime()),
  }
  assert.equal(changeNoticeOf(BEFORE, same, NOW), null)
  const empty = { name: '뒤풀이', startsAt: null, endsAt: null, place: null }
  assert.equal(changeNoticeOf(empty, { ...empty }, NOW), null)
})

test('만들기 글은 행사 이름과 받침에 맞춘 조사이고 만든 사람 이름이 없다', () => {
  assert.equal(createdNoticeOf('가을 축제'), '가을 축제가 생겼어요')
  assert.equal(createdNoticeOf('신입생 환영회'), '신입생 환영회가 생겼어요')
  assert.equal(createdNoticeOf('종강총회'), '종강총회가 생겼어요')
  assert.equal(createdNoticeOf('체육대회 결승전'), '체육대회 결승전이 생겼어요')
})

test('한글이 아닌 끝 글자도 읽는 소리로 조사를 고르고, 괄호·문장 부호는 건너뛴다', () => {
  assert.equal(createdNoticeOf('2026 MT'), '2026 MT가 생겼어요')
  assert.equal(createdNoticeOf('VADA Jam'), 'VADA Jam이 생겼어요')
  assert.equal(createdNoticeOf('축제 (1)'), '축제 (1)이 생겼어요')
  assert.equal(createdNoticeOf('해커톤!'), '해커톤!이 생겼어요')
  assert.equal(createdNoticeOf('제2회 축제'), '제2회 축제가 생겼어요')
  // 읽을 글자가 없으면 두 조사를 함께 쓴다.
  assert.equal(createdNoticeOf('★'), '★이(가) 생겼어요')
})
