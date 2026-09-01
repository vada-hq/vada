import { and, eq } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'
import { Blocked, NotFound } from '../routes.ts'
import { fieldMoment, momentOf } from '../time.ts'

// 행사 기본정보를 **고치는** 자리(EVT-02B).
//
// **`event.basics`와 갈라져 있는 까닭을 명세가 적어 두었다.** 저쪽은 '참가비 납부자
// 무료 / 미납자 5000원' 같은 **그려진 한 줄**을 주고, 이쪽은 **고칠 칸 하나하나**를
// 준다. 같은 사실의 다른 모습이라 조각이 갈린다.
//
// 그래서 이 파일이 지키는 것이 둘이다.
//
// 1. **칸은 칸으로 준다.** 빈 칸에 '미정' 같은 말을 넣으면 사람이 그것을 지우지 않고
//    저장해 행사명이 '미정'이 된다. 없는 칸은 **아예 오지 않는다** — 카탈로그가
//    그 조각들을 optional로 적어 두었고, `event.workspace`의 alert가 이미 같은 길이다.
// 2. **읽지 못한 값을 조용히 대신하지 않는다.** 명세에 없는 참가비 유형, 음수 금액,
//    이 학생회에 없는 부서 — 전부 422로 되돌린다. 받아 두고 무시하면 사람은 저장됐다고
//    믿고 화면은 옛 값을 그린다.

/** 선택지는 **명세가 갖고 있다.** 여기 목록을 다시 적으면 그림이 늘 때 두 벌이 갈린다. */
function optionsOf(key: string): string[] {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string }>
  }>
  const source = sources.find((one) => one.key === key)
  if (source?.options === undefined) {
    throw new Error(`선택지 '${key}'가 명세에 없습니다.`)
  }
  return source.options.map((option) => option.value)
}

export const FEE_TYPES = optionsOf('event.feeTypes')
export const CAPACITY_TYPES = optionsOf('event.capacityTypes')

export interface EventBasicsDraft {
  title: string
  intro?: string
  purpose?: string
  startAt?: string
  endAt?: string
  endUnset: boolean
  place?: string
  placeUnset: boolean
  address?: string
  placeDetail?: string
  audience?: string
  feeType: string
  paidAmount?: string
  unpaidAmount?: string
  payGuide?: string
  capacityType: string
  capacity?: string
  hostDepartment?: string
  hostPerson?: string
  contact?: string
  notice?: string
}

/**
 * 편집 패널이 처음 받는 값.
 *
 * **담당 부서·담당자를 이름으로 준다.** 표는 '이 조직의 그 부서'를 가리키는데
 * 그림의 그 자리는 고를 것이 없는 **글 칸**이다(select가 아니다). 그래서 나갈 때
 * 이름이 되고 들어올 때 다시 그 조직 안에서 찾는다 — 어느 쪽이든 남의 조직의
 * 부서가 붙지 않는다.
 */
export async function eventBasicsDraft(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventBasicsDraft> {
  const rows = await db
    .select({
      title: events.title,
      intro: events.intro,
      purpose: events.purpose,
      startAt: events.startAt,
      endAt: events.endAt,
      endUnset: events.endUnset,
      place: events.place,
      placeUnset: events.placeUnset,
      address: events.address,
      placeDetail: events.placeDetail,
      audience: events.audience,
      feeType: events.feeType,
      paidAmount: events.paidAmount,
      unpaidAmount: events.unpaidAmount,
      payGuide: events.payGuide,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
      contact: events.contact,
      notice: events.notice,
      departmentName: departments.name,
      hostName: members.name,
    })
    .from(events)
    // 조직이 같은 부서·사람만 잇는다 — 이음매마다 울타리를 다시 세운다.
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  // 계약이 늘 오라고 한 셋과, 표가 참거짓으로 아는 둘. 나머지는 값이 있을 때만 붙는다.
  const draft: EventBasicsDraft = {
    title: row.title,
    feeType: row.feeType,
    capacityType: row.capacityType,
    endUnset: row.endUnset,
    placeUnset: row.placeUnset,
  }
  const words: Array<[keyof EventBasicsDraft, string | null]> = [
    ['intro', row.intro],
    ['purpose', row.purpose],
    ['place', row.place],
    ['address', row.address],
    ['placeDetail', row.placeDetail],
    ['audience', row.audience],
    ['payGuide', row.payGuide],
    ['hostDepartment', row.departmentName],
    ['hostPerson', row.hostName],
    ['contact', row.contact],
    ['notice', row.notice],
    // 수도 칸에는 글로 들어간다 — 카탈로그가 이 셋을 string으로 적었다.
    ['paidAmount', row.paidAmount === null ? null : String(row.paidAmount)],
    ['unpaidAmount', row.unpaidAmount === null ? null : String(row.unpaidAmount)],
    ['capacity', row.capacityCount === null ? null : String(row.capacityCount)],
    ['startAt', row.startAt === null ? null : fieldMoment(row.startAt)],
    ['endAt', row.endAt === null ? null : fieldMoment(row.endAt)],
  ]
  for (const [key, value] of words) {
    if (value !== null && value !== '') Object.assign(draft, { [key]: value })
  }
  return draft
}

export interface SaveClock {
  now: () => Date
}

/** 글 칸 하나. **빈 글은 저장하지 않는다** — 지운 것과 안 적은 것을 같게 둔다. */
function readWord(draft: Record<string, unknown>, key: string, label: string): string | null {
  const value = draft[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 수 칸 하나.
 *
 * **음수를 막는 것은 판단이다.** 명세는 '0원 가능'만 적고 아래쪽을 말하지 않는다.
 * 받아 두면 '참가비 -5000원'이 신청 폼에 그대로 나가므로 되돌리는 쪽을 고른다.
 *
 * 빈 글을 비움으로 읽는 까닭: 브라우저의 수 칸은 비었을 때 `''`를 보낸다.
 */
function readCount(draft: Record<string, unknown>, key: string, label: string): number | null {
  const value = draft[key]
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Blocked(`${label} 칸은 0 이상의 정수로 적어 주세요`)
  }
  return value
}

function readFlag(draft: Record<string, unknown>, key: string, label: string): boolean {
  const value = draft[key]
  if (typeof value !== 'boolean') throw new Blocked(`${label} 칸은 참 또는 거짓이어야 합니다`)
  return value
}

/** 명세가 든 선택지가 아니면 막는다. `event.list`가 진행 단계에 쓰는 것과 같은 결이다. */
function readChoice(
  draft: Record<string, unknown>,
  key: string,
  allowed: string[],
  label: string,
): string {
  const value = draft[key]
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Blocked(`그런 ${label}은 없습니다`)
  }
  return value
}

/** 칸에 적힌 때. 읽지 못하면 **막는다** — 지금 시각으로 대신하면 행사가 조용히 옮겨진다. */
function readMoment(draft: Record<string, unknown>, key: string, label: string): Date | null {
  const text = readWord(draft, key, label)
  if (text === null) return null
  const when = momentOf(text)
  if (when === null) throw new Blocked(`${label} 칸의 일시를 읽지 못했습니다`)
  return when
}

/**
 * 이름으로 적힌 담당 부서를 **이 학생회 안에서** 찾는다.
 *
 * 못 찾으면 막는다. 조용히 비우면 사람은 담당을 적었다고 믿고 목록에는 '담당 미정'이
 * 그려진다 — 그 어긋남은 아무도 보지 못한다.
 */
async function hostDepartmentOf(db: Db, orgId: string, name: string | null): Promise<string | null> {
  if (name === null) return null
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.name, name)))
  const found = rows[0]
  if (found === undefined) throw new Blocked(`이 학생회에 그런 부서가 없습니다: ${name}`)
  return found.id
}

/**
 * 이름으로 적힌 담당자를 이 학생회 안에서 찾는다.
 *
 * **이미 그 사람이면 다시 찾지 않는다.** 구성원 이름은 유일하지 않아서 동명이인이
 * 있는 학생회에서는 '열어서 아무것도 안 고치고 저장'이 막힌다 — 고친 것이 없는데
 * 막히는 것은 사람이 이해할 수 없는 실패다.
 */
async function hostMemberOf(
  db: Db,
  orgId: string,
  current: { id: string | null; name: string | null },
  name: string | null,
): Promise<string | null> {
  if (name === null) return null
  if (current.id !== null && current.name === name) return current.id
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.name, name)))
  if (rows.length === 0) throw new Blocked(`이 학생회에 그런 구성원이 없습니다: ${name}`)
  if (rows.length > 1) {
    throw new Blocked(`같은 이름의 구성원이 둘 이상입니다: ${name}`)
  }
  return rows[0]!.id
}

/**
 * 기본정보를 고친다.
 *
 * **보낸 칸만 고친다.** 계약은 PUT이고 '고친 값 전부를 보낸다'고 적었지만, 빠진 칸이
 * '비우라는 뜻'인지 '건드리지 말라는 뜻'인지는 어디에도 없다. 화면은 늘 전부 보내므로
 * 두 해석이 같은 답을 내고, **갈리는 자리에서는 지우지 않는 쪽**을 고른다 — 지운
 * 값은 되돌릴 수 없다.
 *
 * 반대로 **보낸 칸이 비어 있으면 지운다.** 그것은 사람이 화면에서 지운 것이다.
 */
export async function saveEventBasics(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  clock: SaveClock,
): Promise<Record<string, never>> {
  const rows = await db
    .select({ hostMemberId: events.hostMemberId, hostName: members.name })
    .from(events)
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  const changes: Record<string, unknown> = {}
  const has = (key: string) => Object.hasOwn(draft, key)

  if (has('title')) {
    const title = readWord(draft, 'title', '행사명')
    // 행사를 만들 때와 같은 규칙이다 — 이름 없는 행사는 목록에서 가리킬 수 없다.
    if (title === null) throw new Blocked('행사명을 적어 주세요')
    changes.title = title
  }
  if (has('intro')) changes.intro = readWord(draft, 'intro', '행사 소개')
  if (has('purpose')) changes.purpose = readWord(draft, 'purpose', '행사 목적·주요 내용')
  if (has('startAt')) changes.startAt = readMoment(draft, 'startAt', '시작 일시')
  if (has('endAt')) changes.endAt = readMoment(draft, 'endAt', '종료 일시')
  if (has('endUnset')) changes.endUnset = readFlag(draft, 'endUnset', '종료 시간 미정')
  if (has('place')) changes.place = readWord(draft, 'place', '장소')
  if (has('placeUnset')) changes.placeUnset = readFlag(draft, 'placeUnset', '장소 미정')
  if (has('address')) changes.address = readWord(draft, 'address', '주소')
  if (has('placeDetail')) changes.placeDetail = readWord(draft, 'placeDetail', '상세 위치')
  if (has('audience')) changes.audience = readWord(draft, 'audience', '참가 대상')
  if (has('feeType')) changes.feeType = readChoice(draft, 'feeType', FEE_TYPES, '참가비 유형')
  if (has('paidAmount')) changes.paidAmount = readCount(draft, 'paidAmount', '납부자 금액')
  if (has('unpaidAmount')) changes.unpaidAmount = readCount(draft, 'unpaidAmount', '미납자 금액')
  if (has('payGuide')) changes.payGuide = readWord(draft, 'payGuide', '결제 안내')
  if (has('capacityType')) {
    changes.capacityType = readChoice(draft, 'capacityType', CAPACITY_TYPES, '정원 유형')
  }
  if (has('capacity')) changes.capacityCount = readCount(draft, 'capacity', '정원 인원')
  if (has('contact')) changes.contact = readWord(draft, 'contact', '문의 방법·연락처')
  if (has('notice')) changes.notice = readWord(draft, 'notice', '참가자 유의사항')
  if (has('hostDepartment')) {
    changes.hostDepartmentId = await hostDepartmentOf(
      db,
      orgId,
      readWord(draft, 'hostDepartment', '담당 부서'),
    )
  }
  if (has('hostPerson')) {
    changes.hostMemberId = await hostMemberOf(
      db,
      orgId,
      { id: row.hostMemberId, name: row.hostName },
      readWord(draft, 'hostPerson', '담당자'),
    )
  }

  // **언제 손댔는지는 서버가 안다.** 목록의 '오늘 10:00 수정'이 이 값에서 나오므로
  // 고쳐 놓고 이것을 두면 그 줄이 거짓말을 한다.
  changes.updatedAt = clock.now()
  await db
    .update(events)
    .set(changes)
    // 고칠 때도 조직을 다시 건다. 위에서 찾았다고 여기서 빼면 울타리가 한 겹이 된다.
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
  // 계약이 '돌려주는 값이 없다'고 적었다.
  return {}
}
