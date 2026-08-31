import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { attendanceQrs, events } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { hashToken, newToken } from '../public/tokens.ts'

// 운영진이 보는 참석 확인 QR(EVT-04B).
//
// **밖에서 오는 사람 쪽은 이미 지었다.** 참가자가 찍는 자리(`public/attendance.ts`)와
// 그 표가 먼저 생겼고, 여기는 그 QR을 **만들고 죽이는** 쪽이다. 고리를 닫는 자리다.
//
// **토큰은 여기서도 나가지 않는다.** 이 출처가 답하는 것은 상태·시간·안내문·파일
// 이름뿐이다 — 그림에도 그렇게 그려져 있고, 그래서 운영 화면이 새더라도 QR 자체가
// 새지는 않는다. 표에는 해시만 있으므로 애초에 원문을 돌려줄 수도 없다.

export interface Clock {
  now: () => Date
}

/** 참가자에게 어떻게 쓰는지 알린다. **완성된 글로 준다** — 화면이 이어 붙이지 않는다. */
const GUIDE = '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.'

function stamp(at: Date | null, note: string): string {
  if (at === null) return note
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}. ${pad(at.getMonth() + 1)}. ${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * 파일 이름은 **서버가 정한다.**
 *
 * 명세가 "무엇을 어떤 형식으로 낼지는 서버가 정한다"고 적었다. 화면이 정하면 행사
 * 이름을 다듬는 규칙이 화면마다 흩어진다.
 *
 * **그림을 만드는 일은 아직 없다.** 이름만 답하고 실제 파일은 내지 않는다 — 화면도
 * 지금은 그 이름을 알리기만 한다. 숨기지 않고 적어 둔다.
 */
function fileNameOf(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '-')
  return `${safe === '' ? '행사' : safe}-참석확인-QR.png`
}

export interface AttendanceQrCard {
  statusLabel: string
  statusTone: string
  startAt: string
  endAt: string
  guideNote: string
  fileName: string
}

/**
 * 지금 이 행사의 QR.
 *
 * **아직 만들지 않았으면 없다고 한다.** 빈 카드를 그리면 화면은 QR이 있는데 시간이
 * 안 정해진 것과 아예 없는 것을 구분하지 못한다.
 */
export async function attendanceQr(
  db: Db,
  orgId: string,
  eventId: string,
  time: Clock,
): Promise<AttendanceQrCard> {
  const rows = await db
    .select({
      active: attendanceQrs.active,
      opensAt: attendanceQrs.opensAt,
      closesAt: attendanceQrs.closesAt,
      title: events.title,
    })
    .from(attendanceQrs)
    // 조직이 같은 행사만 잇는다 — 이음매마다 울타리를 다시 세운다.
    .innerJoin(events, and(eq(events.id, attendanceQrs.eventId), eq(events.orgId, attendanceQrs.orgId)))
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('이 행사의 참석 확인 QR이 아직 없습니다')

  const now = time.now()
  return {
    ...status(row, now),
    startAt: stamp(row.opensAt, '시작 시간 미정'),
    endAt: stamp(row.closesAt, '종료 시간 미정'),
    guideNote: GUIDE,
    fileName: fileNameOf(row.title),
  }
}

/**
 * 지금 어떤 상태인가.
 *
 * **명세가 목록을 들지 않는다**(`statusLabel`의 설명). 무엇이 QR을 막는지는 시간과
 * 운영진의 조작이 정하고, 명세가 목록을 들면 하나 늘 때마다 명세가 틀린다.
 */
function status(
  row: { active: boolean; opensAt: Date | null; closesAt: Date | null },
  now: Date,
): { statusLabel: string; statusTone: string } {
  if (!row.active) return { statusLabel: '비활성화됨', statusTone: 'gray' }
  if (row.opensAt !== null && now < row.opensAt) {
    return { statusLabel: '시작 전', statusTone: 'gray' }
  }
  if (row.closesAt !== null && now > row.closesAt) {
    return { statusLabel: '마감됨', statusTone: 'yellow' }
  }
  return { statusLabel: '활성 중', statusTone: 'green' }
}

export interface Ids {
  newId: () => string
}

async function eventOf(db: Db, orgId: string, eventId: string): Promise<string> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  if (rows.length === 0) throw new NotFound('그 행사를 찾지 못했습니다')
  return eventId
}

/**
 * QR을 다시 만든다.
 *
 * **되돌릴 수 없다**(계약의 `irreversible`). 새 열쇠가 나오는 순간 옛 링크는 죽고,
 * 이미 뿌린 포스터와 단톡방의 QR이 전부 못 쓰게 된다 — 그래서 화면이 먼저 묻는다.
 *
 * **줄을 새로 만들지 않고 그 자리의 열쇠만 바꾼다.** 새 줄을 만들면 이미 찍은
 * 사람들이 옛 줄에 남고, 새 QR로 다시 찍을 수 있게 된다 — 한 사람이 두 번 세어진다.
 * 같은 줄이면 `(qrId, 학번)` 유일이 그대로 지킨다.
 *
 * 아직 QR이 없으면 이것이 **처음 만드는 일**이다. 만드는 자리를 따로 두지 않는
 * 까닭은 그림에 그런 단추가 없기 때문이다 — 지어내지 않는다.
 */
export async function regenerateAttendanceQr(
  db: Db,
  orgId: string,
  eventId: string,
  make: Ids & Clock,
): Promise<Record<string, never>> {
  await eventOf(db, orgId, eventId)
  const token = newToken()
  const changed = await db
    .update(attendanceQrs)
    .set({ tokenHash: hashToken(token), active: true })
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
    .returning({ id: attendanceQrs.id })
  if (changed.length === 0) {
    await db.insert(attendanceQrs).values({
      id: make.newId(),
      orgId,
      eventId,
      tokenHash: hashToken(token),
      active: true,
    })
  }
  return {}
}

/**
 * QR을 끈다.
 *
 * 되돌릴 수 있다 — 다시 켜는 자리는 `regenerate`뿐이지만 그것은 열쇠까지 바꾼다.
 * **끄는 것과 바꾸는 것은 다른 일이다**: 행사가 끝나 더 안 받는 것과, 열쇠가 샜으니
 * 새로 뿌리는 것.
 */
export async function deactivateAttendanceQr(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<Record<string, never>> {
  const changed = await db
    .update(attendanceQrs)
    .set({ active: false })
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
    .returning({ id: attendanceQrs.id })
  if (changed.length === 0) throw new NotFound('이 행사의 참석 확인 QR이 아직 없습니다')
  return {}
}
