/** 체크 상자가 켜졌다는 뜻으로 초안에 담기는 글. */
export const ON = 'y'

/** 서버의 단일 값을 화면 초안의 문자열로 옮긴다. */
export function draftValueOf(value: unknown): string {
  if (typeof value === 'boolean') return value ? ON : ''
  return String(value)
}
