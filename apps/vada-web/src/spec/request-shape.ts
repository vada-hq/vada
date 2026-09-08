import bodies from '../../../../specs/figma/vada-wireframe/request-bodies.json'

/**
 * 나가는 몸통을 **계약에 대고 잰다.**
 *
 * ## 왜 이 자리가 생겼나
 *
 * ORG-02가 부서를 `'기획부\n홍보부'`라는 글 하나로 보냈고, 서버는 계약대로 배열을
 * 요구해 422로 막았다. **눌러도 학생회가 안 만들어졌다** — 배포된 것을 사람이 눌러
 * 보고서야 알았다(2026-09-09).
 *
 * 검사는 그동안 초록이었다. 서버 쪽 검사가 있었는데 그 검사는 **손으로 계약의 배열을
 * 적어 넣고** 그것을 쟀다(`joining.server.test.tsx`의 `DRAFT`). 화면이 실제로 무엇을
 * 만드는지는 아무도 재지 않았다. 이 저장소가 이미 배운 '빈 것에 대고 재면 늘
 * 통과한다'와 같은 일이 다른 옷을 입고 온 것이다 — **손으로 지은 것에 대고 재면 늘
 * 통과한다.**
 *
 * 서버마다 화해가 달랐던 것도 같은 뿌리다. 회의와 구매는 서버가 두 꼴을 다 받아 주기로
 * 했고(`api/src/purchases/body.ts`), 학생회 만들기는 배열만 받기로 했다
 * (`api/src/org/joining.ts`). 어느 쪽이 계약인지 아무도 정하지 않은 채 파일마다 따로
 * 정했다.
 *
 * **그래서 문을 하나 둔다.** 계약이 꼴을 정하고, 나가는 몸통은 전부 그 꼴이어야 한다.
 * 어긋나면 보내기 전에 던진다 — 422를 받고 '학생회를 만들지 못했습니다'를 그리는
 * 것보다, 어느 칸이 무슨 꼴이어야 하는지 말하는 편이 훨씬 빠르다.
 *
 * ## 무엇을 재고 무엇을 안 재나
 *
 * **꼴만 잰다.** 보낸 칸이 계약이 적은 꼴인지 본다.
 *
 * 빠진 칸은 **안 잰다.** 임시 저장이 같은 계약으로 덜 채운 몸통을 보내고(회의 임시
 * 저장·구매 요청 임시 저장), 무엇이 있어야 저장할 수 있는지는 조직의 규칙이라
 * 서버가 안다. 화면이 그 판정을 흉내 내면 두 벌이 되고 두 벌은 갈린다.
 *
 * 계약에 없는 칸도 **안 막는다.** 지금 한 자리가 그렇다: ORG-02는 초안 둘
 * (`onboardingDraft` · `orgCreationDraft`)을 합쳐 보내는데 계약의 `payloadScope`는
 * 하나만 말할 수 있어, 학적 칸 넷이 계약에 없는 채로 나간다. **계약의 구멍이지 화면의
 * 잘못이 아니므로** 여기서 막으면 옳은 화면이 멈춘다. 그 구멍은 백로그에 있다.
 */

type Schema = {
  type?: string
  properties?: Record<string, Schema>
  items?: Schema
  required?: string[]
}

const CONTRACT = bodies as Record<string, Schema>

/** 계약과 갈린 몸통. **보내기 전에 멈춘다.** */
export class OffContract extends Error {
  readonly key: string
  readonly field: string

  constructor(key: string, field: string, said: string) {
    super(`'${key}'가 보내려는 몸통이 계약과 다릅니다 — ${field}: ${said}`)
    this.name = 'OffContract'
    this.key = key
    this.field = field
  }
}

/** 이 값이 계약이 적은 꼴인가. 맞으면 null, 아니면 사람이 읽을 말. */
function mismatch(schema: Schema, value: unknown): string | null {
  // 안 보낸 칸은 여기서 보지 않는다 — 빠진 것은 서버가 본다.
  if (value === null || value === undefined) return null
  switch (schema.type) {
    case 'array':
      if (!Array.isArray(value)) {
        return `줄의 배열이어야 하는데 ${typeName(value)}이(가) 왔습니다`
      }
      for (const [at, row] of value.entries()) {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) {
          return `${at + 1}번째 줄이 물건이 아니라 ${typeName(row)}입니다`
        }
        for (const need of schema.items?.required ?? []) {
          if ((row as Record<string, unknown>)[need] === undefined) {
            return `${at + 1}번째 줄에 '${need}'이(가) 없습니다`
          }
        }
      }
      return null
    case 'boolean':
      return typeof value === 'boolean' ? null : `참거짓이어야 하는데 ${typeName(value)}이(가) 왔습니다`
    case 'string':
      return typeof value === 'string' ? null : `글이어야 하는데 ${typeName(value)}이(가) 왔습니다`
    case 'integer':
    case 'number':
      // 화면은 수를 글로 실어 보낸다(초안은 글의 맵이다). 서버가 그것을 읽어 준다
      // (`body.ts`의 readCount) — 계약이 수라 적은 자리에 글이 오는 것은 알려진 꼴이다.
      return typeof value === 'number' || typeof value === 'string'
        ? null
        : `수여야 하는데 ${typeName(value)}이(가) 왔습니다`
    default:
      return null
  }
}

function typeName(value: unknown): string {
  if (value === null) return '빈 것'
  if (Array.isArray(value)) return '배열'
  const said: Partial<Record<string, string>> = {
    string: '글',
    number: '수',
    boolean: '참거짓',
    object: '물건',
  }
  return said[typeof value] ?? typeof value
}

/**
 * 이 계약이 몸통을 받는가. 안 받으면 화면도 안 보내야 한다.
 *
 * 명세가 `payloadScope`를 적지 않은 변이 스물셋이 그렇다 — 누르는 것 자체가 뜻이고
 * (회의 시작, 초대 다시 만들기) 실어 갈 값이 없다.
 */
export function takesBody(method: string, path: string): boolean {
  return `${method} ${path}` in CONTRACT
}

/**
 * 보내기 전에 잰다. 어긋나면 던진다.
 *
 * **몸통을 안 받는 자리에 몸통을 보내는 것도 어긋남이다.** 조용히 버리면 화면은
 * 보냈다고 믿고 서버는 못 받는다.
 */
export function checkBody(key: string, method: string, path: string, payload: unknown): void {
  const schema = CONTRACT[`${method} ${path}`]
  if (schema === undefined) {
    const empty =
      payload === undefined ||
      payload === null ||
      (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0)
    if (!empty) {
      throw new OffContract(key, '몸통', '이 계약은 몸통을 받지 않습니다')
    }
    return
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new OffContract(key, '몸통', `물건이어야 하는데 ${typeName(payload)}이(가) 왔습니다`)
  }
  for (const [field, one] of Object.entries(schema.properties ?? {})) {
    const said = mismatch(one, (payload as Record<string, unknown>)[field])
    if (said !== null) throw new OffContract(key, field, said)
  }
}
