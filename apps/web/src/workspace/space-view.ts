import type { Page } from './pages'

// 행사 이름 앞의 연도 글('2026 ', '2026학년도 '). 해마다 같은 행사가 모두 '2'로 보이지 않게 지운다(DEC-96).
const YEAR_PREFIX = /^\d{4}(학년도)?\s*/
// 보이는 글자 하나(자소 묶음)로 자른다. 이모지를 반쪽으로 자르지 않는다.
const graphemes = new Intl.Segmenter('ko', { granularity: 'grapheme' })
const firstOf = (text: string): string | undefined =>
  graphemes.segment(text)[Symbol.iterator]().next().value?.segment

// 옆 메뉴 행사 줄의 네모 안 첫 글자. 연도 글을 지워 비면 원래 이름의 첫 글자다.
export const eventInitial = (name: string) =>
  firstOf(name.replace(YEAR_PREFIX, '')) ?? firstOf(name) ?? ''

// 옆 메뉴에서 켤 칸 하나(DEC-78 규칙 1). 행사 기록은 공간 묶음에 그 줄이 있으면 그 줄, 없으면(6번째, 완료) [행사 모두 보기]이고,
// 행사 목록도 [행사 모두 보기]다. 설정은 옆 메뉴에 칸이 없어 켜지 않는다.
export type ActiveItem =
  | { kind: 'menu'; menu: Exclude<Page, 'events' | 'settings'> }
  | { kind: 'event'; id: string }
  | { kind: 'allEvents' }
  | null

export function activeItemOf(
  page: Page,
  openEventId: string | null,
  shown: readonly { id: string }[],
): ActiveItem {
  if (page === 'settings') return null
  if (page !== 'events') return { kind: 'menu', menu: page }
  if (openEventId && shown.some(event => event.id === openEventId))
    return { kind: 'event', id: openEventId }
  return { kind: 'allEvents' }
}

export const menuActive = (active: ActiveItem, menu: Page) =>
  active?.kind === 'menu' && active.menu === menu
