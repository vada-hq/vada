import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STATUS as TASK_STATUS, statusesOfTab } from '../../../api/src/tasks/labels.ts'
import { STATUS as DOCUMENT_STATUS } from '../../../api/src/documents/labels.ts'
import { AGENDA_STATUS } from '../../../api/src/meetings/detail.ts'
import { FILTERED_FIXTURES } from './fixtures'
import type { DataRow } from './catalog'
import { isServed } from './served'

// **개발용 응답이 서버와 다른 말을 하는가.**
//
// 개발용 응답은 **그림의 값**이다 — 화면과 reference.png를 눈으로 대조하려고 둔다.
// 그래서 서버가 붙어도 지우지 않는다. 다만 그 값 중에는 **그려진 것이 아니라
// 규칙으로 정해지는 것**이 섞여 있다: 어느 갈피에 드는가, 어떤 색인가.
//
// 그런 자리는 규칙이 두 곳에 생기고, 갈리면 **아무도 모른다** — 개발 빌드와 그림
// 대조는 개발용 응답을 보고 배포된 화면은 서버를 본다. 같은 업무가 개발자 화면에서는
// '해야 할 업무'에, 사람의 화면에서는 '진행 중'에 놓인다. 실제로 그랬다(2026-09-06).
//
// **주인을 자리마다 적는다.** 같은 딱지 말이 영역마다 다른 색일 수 있어(문서의
// '검토 중'은 노랑, 업무의 '검토 중'은 보라) 통째로 견주면 없는 갈림을 만들어 낸다.

const source = readFileSync(fileURLToPath(new URL('./fixtures.ts', import.meta.url)), 'utf8')

/**
 * 개발용 응답의 덩이마다 `status`와 `statusTone` 짝을 뽑는다.
 *
 * **글자를 읽는다.** 약한 줄 알고 쓴다 — 이름이 바뀌면 헛돈다. 다만 덩이가 모듈
 * 안에만 있어 밖에서 부를 길이 없고, 잡으려는 것('한 말에 두 색')은 글자에 그대로
 * 드러난다. 안 잡히면 조용하다는 것이 더 나쁘다.
 */
function pairsByRecord(): Map<string, Array<{ label: string; tone: string }>> {
  const found = new Map<string, Array<{ label: string; tone: string }>>()
  let record = '(파일 머리)'
  const pair = /status:\s*'([^']*)',\s*\n\s*statusTone:\s*'([^']*)'/
  const lines = source.split('\n')
  for (let at = 0; at < lines.length; at += 1) {
    const named = /^const ([A-Z][A-Z0-9_]*)\b/.exec(lines[at]!)
    if (named !== null) record = named[1]!
    const both = pair.exec(`${lines[at]}\n${lines[at + 1] ?? ''}`)
    if (both !== null) {
      const rows = found.get(record) ?? []
      rows.push({ label: both[1]!, tone: both[2]! })
      found.set(record, rows)
    }
  }
  return found
}

/** 이 덩이의 말–색 짝은 어느 규칙이 정하는가. */
const OWNED: Array<{ record: string; table: Record<string, { label: string; tone: string }>; why: string }> = [
  {
    record: 'EVENT_DOCUMENTS',
    table: DOCUMENT_STATUS,
    why: '행사 문서 표(EVT-DOC-01). 단계의 말과 색을 서버가 함께 정한다.',
  },
  {
    record: 'TASK_WORK_DOCUMENTS',
    table: DOCUMENT_STATUS,
    why: '업무가 내놓은 것(EVT-TASK-02). 같은 문서 단계다.',
  },
  {
    record: 'TASK_REFERENCE_DOCUMENTS',
    table: DOCUMENT_STATUS,
    why: '업무가 따르는 원본(EVT-TASK-02). 같은 문서 단계다.',
  },
  {
    record: 'MEETING_AGENDAS',
    table: AGENDA_STATUS,
    why: '안건의 단계(OPS-MEET-05A). 아직 안 한 것은 노랑, 지금 하는 것은 초록, 마친 것은 회색이다.',
  },
]

/**
 * **아직 안 정해진 갈림.** 여기 적힌 것만 봐준다.
 *
 * 개발용 응답이 그림을 옮긴 것이고 **그림과 서버가 진짜로 어긋난** 자리다. 고르는
 * 것은 사람의 일이라 여기 적어 두고, 정해지면 한쪽을 고쳐 이 줄을 지운다. 조용히
 * 넘기지 않는 것이 이 표의 뜻이다.
 */
const UNSETTLED: Array<{ what: string; why: string }> = [
  {
    what: "my.tasks의 '검토 필요'",
    why:
      "MY-01이 그린 것: 줄의 딱지가 '검토 필요'이고 그 두 줄이 '해야 할 업무' 갈피에 " +
      "있으며 갈피 수도 2/2/0으로 그것과 맞는다. 서버가 정한 것: 단계 `review`의 말은 " +
      "'검토 중'이고 갈피는 '진행 중'이다(검토 중인 업무는 아직 안 끝났다). " +
      '그림 안에서는 앞뒤가 맞으므로 그림이 스스로 어긋난 것이 아니라 **그림과 서버가 ' +
      '어긋난 것**이다. 어느 쪽이 맞는지는 사람이 정한다 — 정해지기 전에 한쪽으로 ' +
      '옮기면 그림 대조가 그 자리에서 예외를 하나 더 갖게 된다.',
  },
]

const rowsOf = (key: string, params: Record<string, string>): DataRow[] => {
  const filtered = FILTERED_FIXTURES[key]
  return filtered === undefined ? [] : filtered(params)
}

describe('개발용 응답이 서버와 다른 말을 하지 않는다', () => {
  it('내 업무는 서버가 답하는 자리다 — 갈릴 수 있는 자리라야 잴 뜻이 있다', () => {
    expect(isServed('my.tasks')).toBe(true)
  })

  it('내 업무의 단계 말이 서버가 내놓는 말이다', () => {
    const known = Object.values(TASK_STATUS).map((one) => one.label)
    const unknown = new Set<string>()
    for (const tab of ['todo', 'inProgress', 'done']) {
      for (const row of rowsOf('my.tasks', { tab })) {
        const said = String(row.status ?? '')
        if (said !== '' && !known.includes(said)) unknown.add(said)
      }
    }
    expect(
      [...unknown].filter((said) => !UNSETTLED.some((one) => one.what.includes(said))),
      `서버가 내놓지 않는 말입니다. 서버가 주는 것은 ${known.join('·')}입니다`,
    ).toEqual([])
  })

  it('내 업무의 갈피가 서버의 갈피 규칙과 같다', () => {
    const wrong: string[] = []
    for (const tab of ['todo', 'inProgress', 'done']) {
      const allowed = statusesOfTab(tab).map((status) => TASK_STATUS[status].label)
      for (const row of rowsOf('my.tasks', { tab })) {
        const said = String(row.status ?? '')
        const settled = !UNSETTLED.some((one) => one.what.includes(said))
        if (said !== '' && settled && !allowed.includes(said)) {
          wrong.push(`${tab}에 '${said}' — 이 갈피는 ${allowed.join('·')}뿐입니다`)
        }
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  // **봐주는 것이 늘면 재는 것이 준다.** 수를 못 박아 조용히 늘지 않게 한다.
  it('아직 안 정해진 갈림이 조용히 늘지 않는다', () => {
    expect(UNSETTLED).toHaveLength(1)
    for (const one of UNSETTLED) expect(one.why.length).toBeGreaterThan(60)
  })

  it('주인이 있는 덩이의 색이 그 규칙의 색과 같다', () => {
    const pairs = pairsByRecord()
    const wrong: string[] = []
    for (const one of OWNED) {
      const rows = pairs.get(one.record)
      expect(rows, `${one.record}에서 말–색 짝을 하나도 못 찾았습니다 — 이름이 바뀌었습니까?`).toBeDefined()
      const byLabel = new Map(Object.values(one.table).map((entry) => [entry.label, entry.tone]))
      for (const row of rows ?? []) {
        const should = byLabel.get(row.label)
        if (should !== undefined && should !== row.tone) {
          wrong.push(`${one.record}의 '${row.label}'가 ${row.tone} — 서버는 ${should}입니다`)
        }
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  // **한 말에 두 색이면 둘 중 하나는 틀렸다.** 주인을 아직 안 적은 덩이도 이것은
  // 스스로 지켜야 한다 — 같은 표 안에서 같은 딱지가 다른 색으로 그려질 수는 없다.
  it('한 덩이 안에서 한 말이 한 색이다', () => {
    const wrong: string[] = []
    for (const [record, rows] of pairsByRecord()) {
      const tones = new Map<string, Set<string>>()
      for (const row of rows) {
        const seen = tones.get(row.label) ?? new Set<string>()
        seen.add(row.tone)
        tones.set(row.label, seen)
      }
      for (const [label, seen] of tones) {
        if (seen.size > 1) wrong.push(`${record}의 '${label}'가 ${[...seen].join('·')} 둘입니다`)
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })
})
