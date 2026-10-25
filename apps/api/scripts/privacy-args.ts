// privacy 명령의 일들이 같이 쓰는 인자 규칙. 값이 없는 플래그는 --apply, --dry-run(미리 보기를 분명히 적는 것), --from-shell뿐이고
// 같은 플래그를 두 번 주거나 --apply와 --dry-run을 같이 주면 받지 않는다.

// 일 하나의 결과: 종료 코드(0이 성공)와 출력할 한 줄. error면 오류 출력으로 낸다.
export type Outcome = { code: number; line: string; error?: true }

const EMAIL_MAX = 320
export const isEmail = (value: string) =>
  value.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+$/.test(value)

// 초대 코드(학생회를 가리는 값, 회장이 운영진 > 사람에서 보는 값). 손으로 옮긴 소문자도 받는다.
const INVITE = /^[2-9A-HJ-NP-Z]{8}$/
export const inviteOf = (value: string | undefined) => {
  const code = value?.toUpperCase()
  return code && INVITE.test(code) ? code : null
}

// 0 이상의 정수 개수(--expect 등). 틀리면 null이다.
export function wholeNumber(value: string | undefined, min: number, max: number) {
  if (value === undefined || !/^\d{1,7}$/.test(value)) return null
  const number = Number(value)
  return number >= min && number <= max ? number : null
}

const FLAGS = ['--apply', '--dry-run', '--from-shell']
export type Flags = { apply: boolean; fromShell: boolean }

export function flagsOf(flags: readonly string[]): Flags | null {
  if (!flags.every(flag => FLAGS.includes(flag)) || new Set(flags).size !== flags.length)
    return null
  const apply = flags.includes('--apply')
  if (apply && flags.includes('--dry-run')) return null
  return { apply, fromShell: flags.includes('--from-shell') }
}

// 값을 받는 이름(--email 등)과 그 값, 남은 플래그로 나눈다. 모르는 이름의 값이나 같은 이름을 두 번 주면 null이다.
export function optionsOf(
  args: readonly string[],
  names: readonly string[],
): { values: Map<string, string>; flags: string[] } | null {
  const values = new Map<string, string>()
  const flags: string[] = []
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]!
    if (!names.includes(arg)) {
      flags.push(arg)
      continue
    }
    const value = args[at + 1]
    if (value === undefined || value.startsWith('--') || values.has(arg)) return null
    values.set(arg, value)
    at += 1
  }
  return { values, flags }
}
