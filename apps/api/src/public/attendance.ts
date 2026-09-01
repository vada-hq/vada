import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { attendanceCheckIns, attendanceQrs, events, students } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { hashToken, looksLikeToken, newToken } from './tokens.ts'
import { clock, stamp } from '../time.ts'

// QR로 온 참석자(EXT-01A · EXT-01B).
//
// **로그인이 없다.** 누가 냈는지는 폼에 적은 이름·학번이 말하고, 어느 QR인지는 주소가
// 실어 온 토큰이 말한다. 그래서 이 층은 다른 곳보다 조심스럽다.

export interface Clock {
  now: () => Date
}

export interface Ids {
  newId: () => string
}

/** 영수증이 얼마나 사는가. 결과를 확인할 만큼만 산다. */
const RECEIPT_LIFE_MS = 1000 * 60 * 60 * 24

async function qrOf(db: Db, token: string) {
  // 모양이 아닌 것은 표를 찾아보기도 전에 막는다.
  if (!looksLikeToken(token)) throw new NotFound('그 QR을 찾지 못했습니다')
  const rows = await db
    .select({
      id: attendanceQrs.id,
      eventId: attendanceQrs.eventId,
      orgId: attendanceQrs.orgId,
      active: attendanceQrs.active,
      opensAt: attendanceQrs.opensAt,
      closesAt: attendanceQrs.closesAt,
      eventName: events.title,
    })
    .from(attendanceQrs)
    .leftJoin(events, and(eq(events.id, attendanceQrs.eventId), eq(events.orgId, attendanceQrs.orgId)))
    .where(eq(attendanceQrs.tokenHash, hashToken(token)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 QR을 찾지 못했습니다')
  return row
}

export interface CheckInForm {
  eventName: string
  statusLabel: string
  statusTone: string
  checkInWindow: string
  guideNote: string
  blockedLabel?: string
  blockedTone?: string
  blockedNote?: string
}

/**
 * QR을 찍으면 처음 보이는 것.
 *
 * **막혔을 때 이름·학번 칸을 그리지 않는다** — 명세가 그렇게 적었고, 그 판정은
 * `blockedNote`가 오는지로 화면이 안다. 무엇이 막는 조건인지는 서버가 정한다.
 */
export async function checkInForm(db: Db, token: string, time: Clock): Promise<CheckInForm> {
  const qr = await qrOf(db, token)
  const now = time.now()
  const window =
    qr.opensAt === null || qr.closesAt === null
      ? '시간대가 정해지지 않았습니다'
      : `${clock(qr.opensAt)} ~ ${clock(qr.closesAt)}`

  const base = {
    eventName: qr.eventName ?? '행사를 찾지 못했습니다',
    checkInWindow: window,
    guideNote: '이름과 학번을 적어 주세요. 학생회 명단과 대조합니다.',
  }

  if (!qr.active) {
    return {
      ...base,
      statusLabel: '체크인 불가',
      statusTone: 'gray',
      blockedLabel: '비활성화된 QR',
      blockedTone: 'gray',
      blockedNote: '이 QR은 더 이상 쓸 수 없습니다. 행사 운영진에게 문의해 주세요.',
    }
  }
  if (qr.opensAt !== null && now < qr.opensAt) {
    return {
      ...base,
      statusLabel: '아직 열리지 않음',
      statusTone: 'gray',
      blockedLabel: '체크인 시작 전',
      blockedTone: 'gray',
      blockedNote: `${clock(qr.opensAt)}부터 체크인할 수 있습니다.`,
    }
  }
  if (qr.closesAt !== null && now > qr.closesAt) {
    return {
      ...base,
      statusLabel: '체크인 마감',
      statusTone: 'yellow',
      blockedLabel: '체크인 시간이 지났습니다',
      blockedTone: 'yellow',
      blockedNote: '행사 운영진에게 문의해 주세요.',
    }
  }
  return { ...base, statusLabel: '체크인 가능', statusTone: 'green' }
}

export interface CheckInResult {
  label: string
  tone: string
  iconName: string
  description: string
  canRetry: boolean
}

/**
 * 낸 사람의 결과.
 *
 * **영수증으로만 연다.** QR 토큰으로 열면 같은 QR을 찍은 다른 사람의 결과가 열린다 —
 * 첫 교차검토가 찾은 구멍이 그것이었다.
 */
export async function checkInResult(
  db: Db,
  receipt: string,
  time: Clock,
): Promise<CheckInResult> {
  if (!looksLikeToken(receipt)) throw new NotFound('그 결과를 찾지 못했습니다')
  const rows = await db
    .select()
    .from(attendanceCheckIns)
    .where(eq(attendanceCheckIns.receiptHash, hashToken(receipt)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 결과를 찾지 못했습니다')
  // **오래 사는 열쇠는 오래 새는 열쇠다.**
  if (time.now() > row.receiptExpiresAt) throw new NotFound('그 결과를 찾지 못했습니다')

  if (row.matched) {
    return {
      label: '참석 완료',
      tone: 'green',
      iconName: 'check',
      description: `${stamp(row.at)} 체크인`,
      canRetry: false,
    }
  }
  return {
    label: '명단에서 찾지 못했습니다',
    tone: 'yellow',
    iconName: 'circle-alert',
    description: '이름이나 학번을 다시 확인해 주세요. 그래도 안 되면 운영진에게 문의해 주세요.',
    // **판정은 서버가 한다** — 명세가 '명단 불일치일 때만'이라 적으면 그 규칙이
    // 명세에 박히고, 규칙이 바뀔 때마다 명세를 고쳐야 한다.
    canRetry: true,
  }
}

export interface CheckInDraft {
  name?: unknown
  studentNumber?: unknown
}

/**
 * 참석을 낸다.
 *
 * **같은 사람이 두 번 내는 것은 표가 막는다.** 손으로 세면 두 요청이 동시에 올 때
 * 둘 다 통과한다. 막혔을 때 **영수증을 돌려주지 않는다** — 학번은 아무나 적을 수
 * 있는 값이고 영수증은 그 사람만 가져야 하는 값이다(2026-08-31 교차검토).
 */
export async function checkIn(
  db: Db,
  token: string,
  draft: CheckInDraft,
  make: Ids & Clock,
): Promise<{ receiptToken: string }> {
  const name = typeof draft.name === 'string' ? draft.name.trim() : ''
  const studentNumber = typeof draft.studentNumber === 'string' ? draft.studentNumber.trim() : ''
  if (name === '' || studentNumber === '') {
    throw new Blocked('이름과 학번을 적어 주세요')
  }

  const qr = await qrOf(db, token)
  const now = make.now()
  if (!qr.active) throw new Blocked('이 QR은 더 이상 쓸 수 없습니다')
  if (qr.opensAt !== null && now < qr.opensAt) throw new Blocked('아직 체크인할 수 없습니다')
  if (qr.closesAt !== null && now > qr.closesAt) throw new Blocked('체크인 시간이 지났습니다')

  // 명단과 대조한다. **없다고 막지 않는다** — 다시 낼 수 있게 하고 그 사실을
  // 결과가 말한다.
  const found = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.orgId, qr.orgId), eq(students.studentNumber, studentNumber)))
    .limit(1)

  const receipt = newToken()
  try {
    await db.insert(attendanceCheckIns).values({
      id: make.newId(),
      qrId: qr.id,
      name,
      studentNumber,
      receiptHash: hashToken(receipt),
      receiptExpiresAt: new Date(now.getTime() + RECEIPT_LIFE_MS),
      matched: found.length > 0,
      at: now,
    })
  } catch {
    // **이미 낸 사실만 알린다.** 영수증은 주지 않는다.
    throw new AlreadyExists('이미 체크인했습니다')
  }
  return { receiptToken: receipt }
}
