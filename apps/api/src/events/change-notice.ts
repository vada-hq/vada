import { dayTimeLabel, koreanDateOf, koreanOf } from '@vada/contracts'

// 공지방 자동 글의 본문(DEC-90, DEC-93). 규칙으로 만든 정해진 글이고 AI가 쓰지 않는다(DEC-71).
// 알리는 것은 이미 정해진 일시(시작·끝)나 장소가 다른 값으로 바뀔 때뿐이다. 이름 변경, 처음 정하기(미정 → 값),
// 비우기(값 → 미정)는 올리지 않는다. 준비 중의 고치기까지 모두에게 방송하면 감시받는 느낌이 들고(DEC-80),
// 바뀐 내용 전부는 행사 이력에 남는다.

type EventFacts = {
  name: string
  startsAt: Date | null
  endsAt: Date | null
  place: string | null
}

const KOREAN_TIME_FROM = 11

// 분까지 같은 순간인가. 일시는 분 단위로 받는다(koreanDateTime).
const sameMoment = (a: Date | null, b: Date | null) =>
  (a ? koreanOf(a) : null) === (b ? koreanOf(b) : null)

// '11월 5일 (목) 14:00 ~ 18:00'. 끝이 다른 날이면 끝에도 날짜를 쓰고, 올해가 아니면 연도를 붙인다.
// 시작이 없으면 일시가 정해지지 않은 것이라 null이다.
function whenText({ startsAt, endsAt }: EventFacts, now: Date) {
  if (!startsAt) return null
  const start = dayTimeLabel(startsAt.toISOString(), now)
  if (!endsAt) return start
  const sameDay = koreanDateOf(startsAt) === koreanDateOf(endsAt)
  const end = sameDay
    ? koreanOf(endsAt).slice(KOREAN_TIME_FROM)
    : dayTimeLabel(endsAt.toISOString(), now)
  return `${start} ~ ${end}`
}

// 정해진 값이 다른 정해진 값으로 바뀌었는가. 어느 쪽이든 비었으면 알리지 않는다.
const replaced = (before: string | null, after: string | null) =>
  before !== null && after !== null && before !== after

// 바뀐 칸마다 한 줄인 글 하나. 알릴 줄이 없으면 null이다(같은 값으로 저장해도 글이 없다).
export function changeNoticeOf(before: EventFacts, after: EventFacts, now: Date): string | null {
  const lines: string[] = []
  const [whenBefore, whenAfter] = [whenText(before, now), whenText(after, now)]
  const momentChanged =
    !sameMoment(before.startsAt, after.startsAt) || !sameMoment(before.endsAt, after.endsAt)
  if (momentChanged && replaced(whenBefore, whenAfter))
    lines.push(`${after.name} 일시가 바뀌었어요 · ${whenBefore} → ${whenAfter}`)
  if (replaced(before.place, after.place))
    lines.push(`${after.name} 장소가 바뀌었어요 · ${before.place} → ${after.place}`)
  return lines.length ? lines.join('\n') : null
}

const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3
const FINALS = 28
// 읽는 소리에 받침이 있는 숫자(영, 일, 삼, 육, 칠, 팔)와 로마자(엘, 엠, 엔, 알)
const DIGITS_WITH_FINAL = '013678'
const LETTERS_WITH_FINAL = 'lmnr'

// 끝 글자의 받침. 괄호·문장 부호·빈칸은 건너뛰고, 읽을 글자가 없으면 null이다.
function hasFinal(word: string): boolean | null {
  for (const char of Array.from(word).reverse()) {
    const code = char.codePointAt(0)!
    if (code >= HANGUL_FIRST && code <= HANGUL_LAST) return (code - HANGUL_FIRST) % FINALS !== 0
    if (/[0-9]/.test(char)) return DIGITS_WITH_FINAL.includes(char)
    if (/[a-z]/i.test(char)) return LETTERS_WITH_FINAL.includes(char.toLowerCase())
  }
  return null
}

// 받침에 맞춘 조사를 붙인다(이/가, 을/를). 고를 수 없으면 '이(가)'처럼 둘 다 쓴다.
function withParticle(word: string, [withFinal, withoutFinal]: [string, string]) {
  const final = hasFinal(word)
  if (final === null) return `${word}${withFinal}(${withoutFinal})`
  return `${word}${final ? withFinal : withoutFinal}`
}

// 행사를 만들면 올리는 글(DEC-93): '{행사}이(가) 생겼어요'. 만든 사람의 이름은 정해진 글로 남기지 않는다(DEC-54).
export const createdNoticeOf = (name: string) => `${withParticle(name, ['이', '가'])} 생겼어요`
