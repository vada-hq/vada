import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 영역마다 몇 자리가 남았는지 센다.
//
// **눈금이 아니라 지도다.** 막지 않고 세기만 한다 — 무엇부터 붙일지 고를 때 본다.
// 막는 자리는 따로 있다: `apps/api/src/app.test.ts`가 계약 219자리 중 몇이 답하는지
// 래칫으로 지키고, `served.test.ts`가 가짜와 진짜를 센다.
//
//     node scripts/left.mjs            영역별 남은 수
//     node scripts/left.mjs 회의        그 영역에 남은 것의 이름
//
// **세는 것은 화면이 읽고 쓰는 자리다.** 계약의 자리 전부가 아니라, 화면이 실제로
// 부르는 것만 센다 — 어느 화면도 안 읽는 자리를 붙여도 사람이 보는 것은 그대로다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WIREFRAME = join(ROOT, 'specs', 'figma', 'vada-wireframe')
const read = (name) => JSON.parse(readFileSync(join(WIREFRAME, name), 'utf8'))

/** 지금 진짜 서버에서 오는 것들. `served/`의 영역 파일이 든다. */
function servedKeys() {
  const dir = join(ROOT, 'apps', 'vada-web', 'src', 'data-sources', 'served')
  const keys = new Set()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'area.ts') continue
    for (const found of readFileSync(join(dir, name), 'utf8').matchAll(/'([a-zA-Z][\w.]*)'/g)) {
      keys.add(found[1])
    }
  }
  return keys
}

/**
 * 화면 이름으로 영역을 가른다.
 *
 * 명세의 `flows.json`은 흐름 둘만 든다(들어오기·학생회 만들기) — 그것은 **여러
 * 화면을 잇는 길**의 목록이지 영역의 목록이 아니다. 영역은 화면 이름의 머리가 말한다.
 */
function areaOf(screenId) {
  if (/^(ONB|SIGN-IN|INV)/.test(screenId)) return '들어오기'
  if (/^EXT/.test(screenId)) return '밖에서'
  if (/^(ORG|HOME|MY)/.test(screenId)) return '조직'
  if (/^(REC|MSG|TASK)/.test(screenId)) return '기록'
  if (/^OPS/.test(screenId)) return '회의'
  if (/^FIN/.test(screenId)) return '재정'
  if (/^EVT/.test(screenId)) return '행사'
  return '기타'
}

/** 화면이 무엇을 읽고 무엇을 보내는지. 이름이 여럿이라 전부 본다. */
const READ_KEYS = new Set([
  'dataSourceKey',
  'optionsSource',
  'candidatesSource',
  'copySourceKey',
  'downloadSourceKey',
  'poolSourceKey',
])

function collect() {
  const served = servedKeys()
  // **명세가 값을 들고 있는 목록은 분모가 아니다.** `static`은 값이 계약 안에 박혀
  // 있어 서버로 갈 일이 없다 — 세면 눈금이 거짓말을 한다.
  const optionType = new Map(read('option-sources.json').sources.map((one) => [one.key, one.type]))

  const dir = join(WIREFRAME, 'screens')
  const areas = new Map()
  const owners = new Map()
  for (const folder of readdirSync(dir)) {
    const path = join(dir, folder, 'screen.json')
    if (!existsSync(path)) continue
    const screen = JSON.parse(readFileSync(path, 'utf8'))
    const screenId = screen.screenId ?? folder
    const area = areaOf(screenId)
    if (!areas.has(area)) areas.set(area, { screens: 0, reads: new Set(), writes: new Set() })
    const bucket = areas.get(area)
    bucket.screens += 1
    const note = (key) => {
      if (!owners.has(key)) owners.set(key, new Set())
      owners.get(key).add(screenId)
    }
    const walk = (node) => {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const one of node) walk(one)
        return
      }
      for (const [name, value] of Object.entries(node)) {
        // 조각 이름은 글일 때도 있고 `{ key }`를 든 묶음일 때도 있다.
        const key =
          typeof value === 'string'
            ? value
            : value !== null && typeof value === 'object' && typeof value.key === 'string'
              ? value.key
              : null
        if (READ_KEYS.has(name) && key !== null && optionType.get(key) !== 'static') {
          bucket.reads.add(key)
          note(key)
        }
        if (name === 'mutationKey' && typeof value === 'string') {
          bucket.writes.add(value)
          note(value)
        }
        walk(value)
      }
    }
    walk(screen)
  }

  return [...areas]
    .map(([area, bucket]) => {
      const reads = [...bucket.reads].filter((key) => !served.has(key)).sort()
      const writes = [...bucket.writes].filter((key) => !served.has(key)).sort()
      return {
        area,
        screens: bucket.screens,
        allReads: bucket.reads.size,
        allWrites: bucket.writes.size,
        reads,
        writes,
        left: reads.length + writes.length,
      }
    })
    .sort((one, other) => one.left - other.left)
}

const rows = collect()
const asked = process.argv[2]

if (asked === undefined) {
  console.log('영역     화면  읽기  쓰기   남은')
  for (const row of rows) {
    const cells = [row.screens, row.allReads, row.allWrites, row.left].map((n) =>
      String(n).padStart(5),
    )
    console.log(`${row.area.padEnd(8)}${cells.join('')}`)
  }
  console.log(`\n합계 남은 ${rows.reduce((sum, row) => sum + row.left, 0)}개`)
  console.log('영역 이름을 주면 그 영역에 남은 것의 이름이 나온다.')
} else {
  const row = rows.find((one) => one.area === asked)
  if (row === undefined) {
    console.log(`그런 영역이 없습니다: ${asked}`)
    console.log(`있는 것: ${rows.map((one) => one.area).join(' · ')}`)
    process.exitCode = 1
  } else {
    for (const key of row.reads) console.log(`읽기  ${key}`)
    for (const key of row.writes) console.log(`쓰기  ${key}`)
    console.log(`\n${row.area}에 남은 ${row.left}개`)
  }
}
