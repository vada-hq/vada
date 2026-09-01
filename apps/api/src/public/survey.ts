import { and, asc, count, eq, isNotNull, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, students, surveyApplications, surveys } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import type { Clock, Ids } from './attendance.ts'
import { hashToken, looksLikeToken, newToken } from './tokens.ts'
import { moment } from '../time.ts'

// 링크로 온 신청자(EXT-02A · EXT-02B · EXT-02C).
//
// 참석과 같은 규칙을 따른다 — 로그인이 없고, 주소가 실어 온 토큰이 어느 설문인지를
// 말하고, 누가 냈는지는 폼이 말한다. 다른 것이 둘이다.
//
// 1. **링크가 막히는 길이 여럿이다.** 꺼짐·모집 전·마감·정원·교체 — 무엇이 막는지는
//    서버가 정한다(명세가 목록을 들지 않는다).
// 2. **막힌 링크와 열린 링크는 서로 다른 자리로 간다.** 그래서 이 파일의 두 답이
//    **하나의 판정**을 함께 쓴다 — 갈림이 두 곳에 적히면 언젠가 둘 다 답하거나
//    둘 다 답하지 않는 상태가 생긴다.

/** 영수증이 얼마나 사는가. 참석과 같다. */
const RECEIPT_LIFE_MS = 1000 * 60 * 60 * 24

interface SurveyRow {
  id: string
  orgId: string
  eventId: string
  active: boolean
  opensAt: Date | null
  closesAt: Date | null
  capacity: number | null
  replacedById: string | null
  completionTitle: string | null
  duesCheck: boolean
}

async function surveyOf(db: Db, token: string): Promise<SurveyRow> {
  // 모양이 아닌 것은 표를 찾아보기도 전에 막는다.
  if (!looksLikeToken(token)) throw new NotFound('그 참여 신청을 찾지 못했습니다')
  const rows = await db
    .select({
      id: surveys.id,
      orgId: surveys.orgId,
      eventId: surveys.eventId,
      active: surveys.active,
      opensAt: surveys.opensAt,
      closesAt: surveys.closesAt,
      capacity: surveys.capacity,
      replacedById: surveys.replacedById,
      completionTitle: surveys.completionTitle,
      duesCheck: surveys.duesCheck,
    })
    .from(surveys)
    .where(eq(surveys.linkToken, token))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 참여 신청을 찾지 못했습니다')
  return row
}

export interface LinkState {
  label: string
  tone: string
  note: string
  actionLabel?: string
  replacementToken?: string
}

/**
 * 이 링크가 **지금 받는가.** 받으면 `null`이다.
 *
 * **판정이 한 곳에 있다.** 신청 폼과 안내 화면이 이 함수의 답을 뒤집어 쓰므로
 * 둘 중 하나만 답하는 것이 우연이 아니라 구조다.
 *
 * 순서가 뜻을 가진다 — 교체를 맨 앞에 둔다. 교체된 설문은 대개 꺼져 있기도 한데,
 * 신청자에게 쓸모 있는 답은 '꺼졌습니다'가 아니라 **'여기로 가세요'**다.
 */
async function blockOf(db: Db, survey: SurveyRow, now: Date): Promise<LinkState | null> {
  if (survey.replacedById !== null) {
    const rows = await db
      .select({ linkToken: surveys.linkToken })
      .from(surveys)
      .where(eq(surveys.id, survey.replacedById))
      .limit(1)
    const next = rows[0]
    return {
      label: '설문이 교체되었습니다',
      tone: 'blue',
      note: '이 링크의 설문은 새 설문으로 바뀌었습니다.',
      // **다섯 중 이것만 갈 곳이 있다.** 나머지 넷에는 단추를 그리지 않는다.
      ...(next === undefined
        ? {}
        : { actionLabel: '새 신청 폼으로 가기', replacementToken: next.linkToken }),
    }
  }
  if (!survey.active) {
    return {
      label: '링크 비활성화',
      tone: 'gray',
      note: '이 링크는 더 이상 쓸 수 없습니다. 행사 운영진에게 문의해 주세요.',
    }
  }
  if (survey.opensAt !== null && now < survey.opensAt) {
    return {
      label: '모집 전',
      tone: 'gray',
      note: `${moment(survey.opensAt)}부터 신청할 수 있습니다.`,
    }
  }
  if (survey.closesAt !== null && now > survey.closesAt) {
    return {
      label: '모집 마감',
      tone: 'yellow',
      note: '신청 기간이 지났습니다. 행사 운영진에게 문의해 주세요.',
    }
  }
  if (survey.capacity !== null) {
    const [counted] = await db
      .select({ value: count() })
      .from(surveyApplications)
      .where(eq(surveyApplications.surveyId, survey.id))
    if ((counted?.value ?? 0) >= survey.capacity) {
      return {
        label: '정원 마감',
        tone: 'orange',
        note: '신청 정원이 모두 찼습니다. 행사 운영진에게 문의해 주세요.',
      }
    }
  }
  return null
}

export interface ApplyForm {
  title: string
  startAt: string
  place: string
  audience: string
  fee: string
}

/**
 * 링크를 열면 보이는 신청 폼의 머리(EXT-02A).
 *
 * **막힌 링크에는 이 답이 없다.** 서버가 상태를 보고 신청 폼이나 안내 화면 중
 * 하나로 보낸다(docs/decisions/product-decisions.md).
 */
export async function applyForm(db: Db, token: string, time: Clock): Promise<ApplyForm> {
  const survey = await surveyOf(db, token)
  if ((await blockOf(db, survey, time.now())) !== null) {
    throw new NotFound('이 링크는 지금 신청을 받고 있지 않습니다')
  }
  const rows = await db
    .select({
      title: events.title,
      startAt: events.startAt,
      place: events.place,
      audience: events.audience,
      fee: events.fee,
    })
    .from(events)
    .where(and(eq(events.id, survey.eventId), eq(events.orgId, survey.orgId)))
    .limit(1)
  const event = rows[0]
  if (event === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  // 비어 있는 것을 지어내지 않는다 — '없다'와 '아직 안 적었다'는 다른 말이다.
  return {
    title: event.title,
    startAt: event.startAt === null ? '일시 미정' : moment(event.startAt),
    place: event.place ?? '장소 미정',
    audience: event.audience ?? '대상 미정',
    fee: event.fee ?? '참가비 안내 없음',
  }
}

/**
 * 링크가 왜 막혔는지(EXT-02C).
 *
 * **막히지 않은 링크에는 이 답이 없다.** 이 출처가 무언가를 답했다는 것 자체가
 * '지금은 받지 않는다'는 뜻이다.
 */
export async function linkState(db: Db, token: string, time: Clock): Promise<LinkState> {
  const survey = await surveyOf(db, token)
  const blocked = await blockOf(db, survey, time.now())
  if (blocked === null) throw new NotFound('이 링크는 막혀 있지 않습니다')
  return blocked
}

export interface ApplyResult {
  title: string
  eventTitle: string
  applicantNote: string
  feeStatus: string
  feeNote?: string
  notices: Array<{ text: string }>
}

/**
 * 낸 사람의 결과 한 장(EXT-02B).
 *
 * **영수증으로만 연다.** 설문 토큰은 같은 링크를 연 모두가 가진 값이므로 그것으로
 * 열면 뒤에 낸 사람이 앞사람의 이름과 납부 상태를 본다.
 */
export async function applyResult(db: Db, receipt: string, time: Clock): Promise<ApplyResult> {
  if (!looksLikeToken(receipt)) throw new NotFound('그 결과를 찾지 못했습니다')
  const rows = await db
    .select({
      name: surveyApplications.name,
      studentNumber: surveyApplications.studentNumber,
      receiptExpiresAt: surveyApplications.receiptExpiresAt,
      orgId: surveys.orgId,
      duesCheck: surveys.duesCheck,
      completionTitle: surveys.completionTitle,
      eventTitle: events.title,
      fee: events.fee,
      contact: events.contact,
    })
    .from(surveyApplications)
    .innerJoin(surveys, eq(surveys.id, surveyApplications.surveyId))
    // 조직이 같은 행사만 잇는다 — 이음매마다 울타리를 다시 세운다.
    .leftJoin(events, and(eq(events.id, surveys.eventId), eq(events.orgId, surveys.orgId)))
    .where(eq(surveyApplications.receiptHash, hashToken(receipt)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 결과를 찾지 못했습니다')
  // **오래 사는 열쇠는 오래 새는 열쇠다.**
  if (time.now() > row.receiptExpiresAt) throw new NotFound('그 결과를 찾지 못했습니다')

  const fee = await feeOf(db, row)
  const notices = [{ text: '· 신청 내역은 이 링크로 다시 확인할 수 있습니다' }]
  // **몇 줄인지는 데이터가 정한다** — 문의처를 적지 않은 행사는 한 줄이다.
  if (row.contact !== null && row.contact !== '') notices.push({ text: `· 문의: ${row.contact}` })

  return {
    title: row.completionTitle ?? '신청이 완료되었습니다',
    eventTitle: row.eventTitle ?? '행사를 찾지 못했습니다',
    // **라벨까지 품은 완성된 한 줄이다** — 신청자를 무엇이라 부를지는 조직의 말이고
    // 화면이 이어 붙이면 그 말이 두 곳에 흩어진다.
    applicantNote: `신청자: ${row.name}`,
    ...fee,
    notices,
  }
}

/**
 * 참가비가 지금 어떤 상태인가.
 *
 * **금액일 수도 상태일 수도 있다.** 학생회비를 대조하는 행사는 명단에서 그 사람을
 * 찾아야 금액이 정해지고, 찾기 전에는 '관리자 확인 중'이다.
 *
 * 대조가 끝나도 줄이 그대로인 까닭은, **납부자·미납자 금액을 따로 두는 자리가 아직
 * 없기 때문이다**(`events.fee`가 사람이 적은 한 줄이다). 그것을 쪼개는 일은 EVT-02B의
 * 몫이고 여기서 지어내지 않는다.
 */
async function feeOf(
  db: Db,
  row: { orgId: string; duesCheck: boolean; studentNumber: string; fee: string | null },
): Promise<{ feeStatus: string; feeNote?: string }> {
  const line = row.fee ?? '참가비 안내 없음'
  if (!row.duesCheck) return { feeStatus: line }

  const found = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.orgId, row.orgId),
        eq(students.studentNumber, row.studentNumber),
        // '확인 필요'로 표시된 사람은 아직 대조가 끝나지 않았다.
        ne(students.duesStatus, 'check'),
      ),
    )
    .limit(1)
  if (found.length > 0) return { feeStatus: line }
  return {
    feeStatus: '관리자 확인 중',
    // 금액이 이미 정해진 행사에는 이 줄이 오지 않는다.
    feeNote: '학생회비 납부 여부를 확인한 뒤 금액이 정해집니다.',
  }
}

export interface ApplyDraft {
  name?: unknown
  studentNumber?: unknown
  college?: unknown
  department?: unknown
  currentGrade?: unknown
  motivation?: unknown
  privacyConsent?: unknown
}

function word(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 참여 신청을 보낸다(EXT-02A).
 *
 * 참석과 같은 규칙이다 — **같은 사람이 두 번 내는 것은 표가 막고**, 막혔을 때
 * **영수증을 돌려주지 않는다**. 학번은 아무나 적을 수 있는 값이고 영수증은 그 사람만
 * 가져야 하는 값이므로 앞의 것으로 뒤의 것을 가릴 수 없다.
 */
export async function apply(
  db: Db,
  token: string,
  draft: ApplyDraft,
  make: Ids & Clock,
): Promise<{ receiptToken: string }> {
  const name = word(draft.name)
  const studentNumber = word(draft.studentNumber)
  const college = word(draft.college)
  const department = word(draft.department)
  const currentGrade = word(draft.currentGrade)
  if (name === '' || studentNumber === '' || college === '' || department === '' || currentGrade === '') {
    throw new Blocked('필수 항목을 모두 적어 주세요')
  }
  // **동의는 참이어야 한다.** 계약이 필수라 적은 것은 '칸이 있다'가 아니라
  // '동의를 받았다'는 뜻이고, 거짓인 채로 받으면 그 신청은 근거 없이 모은 정보다.
  if (draft.privacyConsent !== true) {
    throw new Blocked('개인정보 수집·이용에 동의해야 신청할 수 있습니다')
  }

  const survey = await surveyOf(db, token)
  const now = make.now()
  const blocked = await blockOf(db, survey, now)
  if (blocked !== null) throw new Blocked(blocked.note)

  const receipt = newToken()
  try {
    await db.insert(surveyApplications).values({
      id: make.newId(),
      surveyId: survey.id,
      name,
      studentNumber,
      college,
      department,
      grade: currentGrade,
      motivation: word(draft.motivation) === '' ? null : word(draft.motivation),
      receiptHash: hashToken(receipt),
      receiptExpiresAt: new Date(now.getTime() + RECEIPT_LIFE_MS),
      privacyConsentAt: now,
      at: now,
    })
  } catch {
    // **이미 낸 사실만 알린다.** 영수증은 주지 않는다.
    throw new AlreadyExists('이미 신청했습니다')
  }
  return { receiptToken: receipt }
}

export interface Option {
  value: string
  label: string
}

/**
 * 폼에서 고르는 단과대학·학부(EXT-02A).
 *
 * **명단이 곧 목록이다.** 학교 전체의 학사 편제를 들고 있는 표가 없고, 이 화면에는
 * 학교를 고르는 칸도 없다 — 어느 학교인지는 설문을 연 학생회가 이미 안다. 그래서
 * 그 학생회가 올린 명단에 실제로 있는 값만 고를 수 있게 한다.
 *
 * `collegeId`가 곧 단과대학의 이름인 까닭도 같다. 명단이 글로 들고 있으므로 그 글이
 * 이 자리의 값이다.
 *
 * **없는 토큰에도 빈 목록으로 답한다.** 계약이 이 자리에 404를 두지 않았고, 답을
 * 가려 주면 그것이 토큰이 있는지 없는지를 알려 주는 자리가 된다.
 */
export async function collegeOptions(db: Db, token: string): Promise<Option[]> {
  const survey = await found(db, token)
  if (survey === null) return []
  const rows = await db
    .selectDistinct({ name: students.college })
    .from(students)
    .where(and(eq(students.orgId, survey.orgId), isNotNull(students.college)))
    .orderBy(asc(students.college))
  return rows.flatMap((row) => (row.name === null || row.name === '' ? [] : [option(row.name)]))
}

export async function departmentOptions(
  db: Db,
  token: string,
  collegeId: string,
): Promise<Option[]> {
  const survey = await found(db, token)
  if (survey === null || collegeId === '') return []
  const rows = await db
    .selectDistinct({ name: students.department })
    .from(students)
    .where(
      and(
        eq(students.orgId, survey.orgId),
        eq(students.college, collegeId),
        isNotNull(students.department),
      ),
    )
    .orderBy(asc(students.department))
  return rows.flatMap((row) => (row.name === null || row.name === '' ? [] : [option(row.name)]))
}

function option(name: string): Option {
  return { value: name, label: name }
}

/** 있으면 그 설문, 없으면 null. 목록 자리는 없다고 막지 않는다. */
async function found(db: Db, token: string): Promise<SurveyRow | null> {
  try {
    return await surveyOf(db, token)
  } catch {
    return null
  }
}
