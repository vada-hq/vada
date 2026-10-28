import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ACTIONS } from '@vada/contracts'
import { describe, expect, test } from 'vitest'

// 구조 검사(기능 012 조각 6, work-method '검사와 시험'): 계약이 내보내는 동작 목록(`*_ACTIONS`)의 값마다
// 화면의 시험 아닌 코드에 하나 이상 쓰인다. 동작 하나를 화면에서 지우면 그 이름을 적고 실패한다.
// 서버가 주는 동작을 화면이 안 쓰면 그 동작은 사람에게 닿지 않는 죽은 길이다.

const SRC = join(__dirname, '..')
const IGNORED_DIRS = new Set(['test-support', 'ui-gallery', '__snapshots__'])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return IGNORED_DIRS.has(name) ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// 화면이 안 쓰는 것을 아직 고치지 않고 이유와 함께 허용하는 목록. 이유 없이 더하지 않는다.
const ALLOWED_UNUSED: Record<string, string> = {
  'MEETING_ACTIONS meeting.minutes': '서버(029 조각 2)가 먼저 나간다. 회의록 화면(조각 4)이 쓴다',
}

// 동작 이름은 권한 키(Action)와 떼어 둔다(기능 012 원칙, 012 조각 6 검토 I1): 같은 글자면 `view.permissions.includes('이름')`이
// 그 동작을 읽은 것으로 세어져, 동작을 안 읽는 화면도 위 검사를 통과한다. 지금 겹치는 동작을 이유와 함께 허용한다.
const ALLOWED_PERMISSION_NAMES: Record<string, string> = {
  'EVENT_ACTIONS event.update': '기능 012가 권한 키와 같은 이름으로 냈다. 이름 바꾸기는 따로 한다',
  'EVENT_ACTIONS event.complete':
    '기능 012가 권한 키와 같은 이름으로 냈다. 이름 바꾸기는 따로 한다',
  'APPLICANT_ACTIONS deposit.confirm':
    '기능 012가 권한 키와 같은 이름으로 냈다. 이름 바꾸기는 따로 한다',
}

// index.ts가 안 내보내는 목록도 놓치지 않게 계약의 모듈을 모두 읽는다.
const modules = import.meta.glob<Record<string, unknown>>(
  '../../../../packages/contracts/src/!(*.test).ts',
  { eager: true },
)
const LISTS = Object.values(modules)
  .flatMap(module => Object.entries(module))
  .filter(
    (entry): entry is [string, readonly string[]] =>
      entry[0].endsWith('_ACTIONS') && Array.isArray(entry[1]),
  )

describe('계약의 동작 목록이 화면에 닿는다', () => {
  const code = sources(SRC).map(path => [relative(SRC, path), readFileSync(path, 'utf8')] as const)
  const values = LISTS.flatMap(([list, actions]) => actions.map(action => [list, action] as const))

  test('동작 목록을 찾았다', () => {
    expect(LISTS.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'EVENT_ACTIONS',
        'FORM_ACTIONS',
        'FORM_LIST_ACTIONS',
        'APPLICANT_ACTIONS',
        'PURCHASE_ACTIONS',
        'EXPENSE_ACTIONS',
        'TASK_ACTIONS',
        'ACCOUNT_ACTIONS',
        'CLOSING_ACTIONS',
        'INCOME_ACTIONS',
      ]),
    )
  })

  test('화면의 시험 아닌 코드에 쓰이지 않는 동작이 없다', () => {
    const unused = values
      .filter(([, action]) => !code.some(([, text]) => text.includes(`'${action}'`)))
      .map(([list, action]) => `${list} ${action}`)
      .filter(name => !(name in ALLOWED_UNUSED))
    expect(unused, `화면이 안 쓰는 동작: ${unused.join(', ')}`).toEqual([])
  })

  test('허용 목록은 이유가 있고 여전히 안 쓰는 동작만 적는다', () => {
    for (const [name, reason] of Object.entries(ALLOWED_UNUSED)) {
      expect(reason.length, name).toBeGreaterThan(0)
      const [, action] = name.split(' ')
      expect(
        code.some(([, text]) => text.includes(`'${action!}'`)),
        `${name} 이제 쓰인다. 목록에서 뺀다`,
      ).toBe(false)
    }
  })

  const PERMISSION_KEYS: readonly string[] = ACTIONS
  const sameAsPermission = values
    .filter(([, action]) => PERMISSION_KEYS.includes(action))
    .map(([list, action]) => `${list} ${action}`)

  test('동작 이름은 권한 키와 같은 글자가 아니다', () => {
    const overlapping = sameAsPermission.filter(name => !(name in ALLOWED_PERMISSION_NAMES))
    expect(overlapping, `권한 키와 같은 동작: ${overlapping.join(', ')}`).toEqual([])
  })

  test('권한 키와 같은 글자를 허용한 목록은 이유가 있고 여전히 겹치는 동작만 적는다', () => {
    for (const [name, reason] of Object.entries(ALLOWED_PERMISSION_NAMES)) {
      expect(reason.length, name).toBeGreaterThan(0)
      expect(sameAsPermission, `${name} 이제 겹치지 않는다. 목록에서 뺀다`).toContain(name)
    }
  })
})
