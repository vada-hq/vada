import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { invites } from '../db/schema.ts'
import { dottedStamp as stamp } from '../time.ts'

// 학생회에 들어오는 초대(ORG-03C).
//
// **링크와 코드가 같은 권한이라 한 건으로 온다.** 둘을 따로 두면 하나만 되살렸을 때
// 어느 것이 유효한지 화면이 알 수 없다.

export interface Invite {
  stateLabel: string
  stateTone: string
  stateNote: string
  regeneratedNote: string
  url: string
  code: string
}

/** 링크의 앞부분. 어디에 놓이는지는 배포가 정하므로 밖에서 받는다. */
export interface InviteSettings {
  linkBase: string
  now: () => Date
  /** 새 코드를 만든다. 추측할 수 없어야 한다. */
  newCode: () => string
}

function draw(row: { code: string; active: boolean; regeneratedAt: Date | null; createdAt: Date }, settings: InviteSettings): Invite {
  return {
    stateLabel: row.active ? '활성' : '중지',
    stateTone: row.active ? 'green' : 'gray',
    stateNote: row.active
      ? '현재 사용할 수 있는 초대 정보입니다.'
      : '지금은 이 초대로 들어올 수 없습니다.',
    // 되살린 적이 없으면 만든 때를 말한다. **비어 있는 글을 주지 않는다** —
    // 화면은 그 자리에 무엇이든 그린다.
    regeneratedNote:
      row.regeneratedAt === null
        ? `만든 때: ${stamp(row.createdAt)}`
        : `마지막 재생성: ${stamp(row.regeneratedAt)}`,
    url: `${settings.linkBase}/${row.code}`,
    code: row.code,
  }
}

async function currentRow(db: Db, orgId: string) {
  const rows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.orgId, orgId), eq(invites.active, true)))
    .orderBy(desc(invites.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function currentInvite(
  db: Db,
  orgId: string,
  settings: InviteSettings,
): Promise<Invite | null> {
  const row = await currentRow(db, orgId)
  return row === null ? null : draw(row, settings)
}

/**
 * 초대를 다시 만든다.
 *
 * **전에 나눠 준 것이 그 순간 죽는다.** 되돌릴 수 없으므로 화면이 먼저 확인을
 * 받아야 하고(계약의 `irreversible`), 여기서는 옛 것을 확실히 끄는 것이 몫이다.
 *
 * 링크와 코드를 따로 되살리는 자리가 있지만 **한 건이 둘을 함께 갖는다** — 코드만
 * 바꾸면 링크의 뒤쪽도 함께 바뀐다. 그 사실을 숨기지 않고 셋이 같은 일을 한다.
 */
/**
 * 학생회가 생길 때 첫 초대를 함께 만든다.
 *
 * **초대가 없으면 아무도 못 들어온다.** 그리고 조직도 화면(ORG-03C)이 초대를 읽으므로
 * 그 화면이 통째로 죽는다 — 갓 만든 학생회가 그랬다. 다시 만드는 단추는 그 죽은
 * 화면 안에 있어서 스스로 빠져나올 길도 없었다(2026-09-05, 배포 모양 카나리가 찾음).
 *
 * **다시 만들기와 같은 줄을 쓰지 않는다.** 저쪽은 '전에 나눠 준 것을 끄는 일'이
 * 몫이고 여기는 끌 것이 없다. 합치면 만들 때마다 없는 것을 끄는 갱신이 한 번 돈다.
 */
export async function firstInvite(
  db: Db,
  orgId: string,
  settings: { now: () => Date; newCode: () => string },
): Promise<void> {
  const at = settings.now()
  await db.insert(invites).values({
    code: settings.newCode(),
    orgId,
    active: true,
    createdAt: at,
    regeneratedAt: null,
  })
}

export async function regenerateInvite(
  db: Db,
  orgId: string,
  settings: InviteSettings,
): Promise<Invite> {
  const at = settings.now()
  await db
    .update(invites)
    .set({ active: false })
    .where(and(eq(invites.orgId, orgId), eq(invites.active, true)))

  const code = settings.newCode()
  await db.insert(invites).values({
    code,
    orgId,
    active: true,
    createdAt: at,
    regeneratedAt: at,
  })
  const row = await currentRow(db, orgId)
  return draw(row!, settings)
}
