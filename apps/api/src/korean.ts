/**
 * 이름 뒤에 붙는 조사를 고른다.
 *
 * **끝소리가 정한다.** '초대'는 받침이 없어 '는'이고 '조직도'는 있어 '은'이다.
 * 한쪽으로 고정하면 문장 절반이 틀린 말이 되고, 이름을 문장 밖으로 빼면 사람이
 * 무엇에 대한 말인지 한 번 더 짚어야 한다.
 *
 * **규칙이지 짐작이 아니다.** 한글 음절은 `(코드 - 0xAC00) % 28`이 0이 아닐 때
 * 받침이 있다. 한글로 끝나지 않는 이름(영문·숫자)은 가릴 규칙이 없으므로 받침이
 * 없는 쪽으로 둔다 — 지어내지 않는다.
 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.at(-1)
  if (last === undefined) return withoutFinal
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return withoutFinal
  return (code - 0xac00) % 28 === 0 ? withoutFinal : withFinal
}

/** `이름은` / `이름는`. */
export const topic = (word: string): string => `${word}${josa(word, '은', '는')}`
