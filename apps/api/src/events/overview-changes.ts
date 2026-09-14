import type { Db } from '../db/client.ts'
import { clock, day, daysBetween } from '../time.ts'
import {
  applicationMomentsOf,
  currentSurvey,
  eventFacts,
  touchedOf,
} from './counts.ts'

export interface RecentChange {
  at: string
  title: string
}

/**
 * 최근 몇 줄까지 보이는가.
 *
 * **명세가 수를 정하지 않았다.** 그림이 넷을 그렸고 '최근'이라는 말이 자르라는
 * 뜻이므로 다섯으로 둔다 — 자르지 않으면 오래된 행사에서 이 카드가 화면을 덮는다.
 */
const RECENT = 5

/** `오늘 10:30` · `어제 16:20` · `07. 14`. **오늘이 언제인지는 서버만 안다.** */
function whenNote(at: Date, now: Date): string {
  const days = daysBetween(at, now)
  if (days <= 0) return `오늘 ${clock(at)}`
  if (days === 1) return `어제 ${clock(at)}`
  return day(at).slice(6)
}

/**
 * 최근 변경 사항(EVT-02 · EVT-02D).
 *
 * **표는 무엇이 바뀌었는지를 모른다.** 담고 있는 것은 어느 줄이 언제 만들어졌고
 * 언제 손대졌는가뿐이라, 여기서 만드는 말도 거기까지다 — '행사 장소 ERICA
 * 체육관으로 확정'처럼 무엇이 무엇으로 바뀌었는지 말하려면 옛 값을 담는 표가
 * 있어야 하고, 그런 표는 명세에 없다(`permission_changes`가 권한에만 그것을 둔다).
 *
 * 지어내지 않고 아는 것만 말한다: **무엇이 손대졌는지, 더해진 것인지 고쳐진 것인지.**
 * 그 표가 생기는 날 고칠 자리는 여기와 `counts.ts`의 `touchedOf` 둘이다.
 *
 * 신청은 **하루치를 묶는다** — 한 사람씩 줄이 되면 모집 중인 행사에서 이 카드가
 * 신청자 명단이 되고, 다른 변경이 전부 밀려난다.
 */
export async function recentChanges(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<RecentChange[]> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) return []

  const survey = await currentSurvey(db, orgId, eventId)
  const moments: Array<{ at: Date; title: string }> = [
    {
      at: row.updatedAt,
      title:
        row.updatedAt.getTime() === row.createdAt.getTime()
          ? '행사를 만들었습니다'
          : '행사 기본정보 수정',
    },
    ...(await touchedOf(db, orgId, eventId)).map((one) => ({ at: one.at, title: one.title })),
    ...applicationDays(await applicationMomentsOf(db, survey)),
  ]

  const now = time.now()
  return moments
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, RECENT)
    .map((one) => ({ at: whenNote(one.at, now), title: one.title }))
}

/** 하루에 들어온 신청을 한 줄로. 그 줄의 때는 그날 마지막 신청이다. */
function applicationDays(moments: Date[]): Array<{ at: Date; title: string }> {
  const byDay = new Map<string, { at: Date; count: number }>()
  for (const at of moments) {
    const key = day(at)
    const already = byDay.get(key)
    if (already === undefined) byDay.set(key, { at, count: 1 })
    else byDay.set(key, { at: at > already.at ? at : already.at, count: already.count + 1 })
  }
  return [...byDay.values()].map((one) => ({
    at: one.at,
    title: `신규 신청자 ${one.count}명 추가`,
  }))
}
