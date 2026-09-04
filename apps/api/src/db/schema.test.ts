import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import {
  agendaStatus,
  applyStatus,
  archiveStatus,
  attendance,
  documentStatus,
  duesStatus,
  eventCapacityType,
  eventFeeType,
  eventStatus,
  meetingKind,
  meetingStatus,
  memberRole,
  minutesStatus,
  payStatus,
  purchaseStage,
  quoteStatus,
  reviewResult,
  surveyApplyMethod,
  surveyQuestionType,
  taskStatus,
} from './schema.ts'

// **화면이 보내는 값이 표에 없으면 그 단추는 눌러도 아무것도 못 찾는다.**
//
// 2026-09-02에 값을 치르고 알았다. 행사 목록의 '진행 중' 거르개가 `running`을 보내는데
// 표는 `inProgress`를 담고 있었다 — 그 단추는 **개발용 응답에서조차** 아무것도 못
// 찾았고, 검사 1,900개 중 어느 것도 안 터졌다. 두 벌이 서로 맞기만 하면 되는 자리에서
// 두 벌이 서로 달랐고, 그 사실을 볼 자리가 없었다.
//
// 이 파일이 그 자리다. 재는 것은 둘이다.
//
// 1. **명세의 고정 목록**이 그것을 담는 값의 갈래와 같은 글자인가.
// 2. **화면이 인자로 박아 보내는 값**(칸반의 열·보드의 단계)이 그 갈래에 있는가.
//
// 둘째가 자동이라 세지 않는다 — 화면을 훑어서 찾는다. 첫째는 손으로 짝지어야 한다:
// 어느 목록이 어느 갈래로 저장되는지는 사람만 안다.

const WIREFRAME = fileURLToPath(new URL('../../../../specs/figma/vada-wireframe/', import.meta.url))

const options = new Map(
  (optionSources as { sources: Array<{ key: string; type: string; options?: Array<{ value: string }> }> }).sources.map(
    (source) => [source.key, source],
  ),
)

/** 고른 값이 표에 담기는 자리. **손으로 짝짓는다** — 목록 이름과 갈래 이름이 다르다. */
const STORED: Array<{
  /** 명세의 고정 목록 */
  option: string
  /** 그 값을 담는 갈래 */
  values: readonly string[]
  /**
   * 값이 아닌 선택지. **'전체'는 거르지 않는다는 뜻이지 저장되는 값이 아니다** —
   * 이것을 빼지 않으면 표마다 쓰지도 않을 갈래가 하나씩 는다.
   */
  notStored?: readonly string[]
}> = [
  { option: 'event.status', values: eventStatus.enumValues, notStored: ['all'] },
  { option: 'event.feeTypes', values: eventFeeType.enumValues },
  { option: 'event.capacityTypes', values: eventCapacityType.enumValues },
  { option: 'event.documentStatus', values: documentStatus.enumValues, notStored: ['all'] },
  { option: 'event.surveyApplyMethods', values: surveyApplyMethod.enumValues },
  { option: 'event.surveyQuestionTypes', values: surveyQuestionType.enumValues },
  { option: 'org.baseRoles', values: memberRole.enumValues },
  { option: 'org.duesStatus', values: duesStatus.enumValues, notStored: ['all'] },
  { option: 'meeting.types', values: meetingKind.enumValues },
  { option: 'finance.quoteStatus', values: quoteStatus.enumValues },
  { option: 'finance.reviewResults', values: reviewResult.enumValues },
]

// **여기 없는 고정 목록도 있다.** 저장되지 않는 것들이다 — 거르개(`task.scope`),
// 갈피(`task.detailTab`), 방식(`event.staffSetupModes`), 그리고 글로 담는 것
// (`org.types`·`org.operatingYears`는 표에서 text다). 갈래가 없으면 견줄 것도 없다.
//
// `my.taskTab`은 특히 여기 두면 안 된다. 셋(todo·inProgress·done)이지만 칸반의
// 넷을 **묶어 본 것**이라 담기는 값이 아니다 — 짝지으면 표가 셋이 되고 칸반이 깨진다.

describe('명세의 고정 목록이 표의 갈래와 같은 글자다', () => {
  it.each(STORED)('$option', ({ option, values, notStored = [] }) => {
    const source = options.get(option)
    expect(source, `${option}이 명세에 없습니다`).toBeDefined()
    expect(source!.type).toBe('static')
    const asked = (source!.options ?? [])
      .map((one) => one.value)
      .filter((value) => !notStored.includes(value))
    // **명세가 든 값이 전부 갈래에 있어야 한다.** 하나라도 없으면 그 선택지는
    // 눌러도 아무것도 못 찾거나 저장하다 터진다.
    expect(asked.filter((value) => !values.includes(value))).toEqual([])
  })

  // 반대 방향도 본다. 갈래에만 있는 값은 고를 길이 없다 — 그런 값은 화면이 만들 수
  // 없으므로 서버만 쓰는 것이고, 그것이 맞다면 여기 적혀 있어야 한다.
  const SERVER_ONLY: Record<string, readonly string[]> = {
    // 완료된 행사는 목록의 선택지에 없다 — 머리의 별도 이동으로 본다(명세의 글).
    'event.status': ['done'],
    // 아직 안 낸 요청은 보드에 오지 않는다. 어딘가에는 있어야 하므로 갈래에는 있다.
    'finance.quoteStatus': [],
  }
  it.each(STORED)('$option — 갈래에만 있는 값은 까닭이 적혀 있다', ({ option, values, notStored = [] }) => {
    const asked = new Set(
      (options.get(option)!.options ?? []).map((one) => one.value).filter((v) => !notStored.includes(v)),
    )
    const extra = values.filter((value) => !asked.has(value))
    expect(extra).toEqual(SERVER_ONLY[option] ?? [])
  })
})

/** 화면이 조회 인자에 글자 그대로 박아 보내는 값들. 훑어서 찾는다. */
function pinnedParams(): Array<{ screenId: string; key: string; param: string; value: string }> {
  const found: Array<{ screenId: string; key: string; param: string; value: string }> = []
  const dir = WIREFRAME + 'screens/'
  for (const folder of readdirSync(dir)) {
    const path = dir + folder + '/screen.json'
    if (!existsSync(path)) continue
    const screen = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const screenId = (screen.screenId as string | undefined) ?? folder
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const one of node) walk(one)
        return
      }
      const holder = node as { dataSourceKey?: unknown; params?: Record<string, unknown> }
      if (typeof holder.dataSourceKey === 'string' && holder.params !== undefined) {
        for (const [param, given] of Object.entries(holder.params)) {
          const value = (given as { value?: unknown }).value
          if (typeof value === 'string') {
            found.push({ screenId, key: holder.dataSourceKey, param, value })
          }
        }
      }
      for (const one of Object.values(node)) walk(one)
    }
    walk(screen)
  }
  return found
}

describe('화면이 박아 보내는 값이 표의 갈래에 있다', () => {
  // **칸반의 열과 보드의 단계가 그렇다.** 목록이 명세에 고정이라 선택지 카탈로그에
  // 없고, 그래서 위의 짝짓기가 못 본다 — 화면을 훑는 까닭이다.
  const WHERE: Record<string, { param: string; values: readonly string[] }> = {
    'task.board': { param: 'status', values: taskStatus.enumValues },
    'event.taskBoard': { param: 'status', values: taskStatus.enumValues },
    'event.financeBoard': { param: 'stage', values: purchaseStage.enumValues },
  }

  it('훑어서 찾은 것이 있다 — 없으면 이 검사가 헛돈다', () => {
    const pinned = pinnedParams().filter(({ key, param }) => WHERE[key]?.param === param)
    expect(pinned.length).toBeGreaterThan(0)
  })

  it('박아 보내는 값이 전부 갈래에 있다', () => {
    const wrong = pinnedParams()
      .filter(({ key, param }) => WHERE[key]?.param === param)
      .filter(({ key, value }) => !WHERE[key]!.values.includes(value))
      .map(({ screenId, key, value }) => `${screenId} ${key}=${value}`)
    expect(wrong).toEqual([])
  })
})

describe('값의 갈래에 빈 것이 없다', () => {
  // 갈래를 만들어 두고 값을 안 넣으면 그 열은 무엇이든 담는다.
  it.each([
    ['agendaStatus', agendaStatus.enumValues],
    ['applyStatus', applyStatus.enumValues],
    ['archiveStatus', archiveStatus.enumValues],
    ['attendance', attendance.enumValues],
    ['meetingStatus', meetingStatus.enumValues],
    ['minutesStatus', minutesStatus.enumValues],
    ['payStatus', payStatus.enumValues],
    ['purchaseStage', purchaseStage.enumValues],
    ['taskStatus', taskStatus.enumValues],
  ])('%s', (_name, values) => {
    expect(values.length).toBeGreaterThan(1)
  })
})
