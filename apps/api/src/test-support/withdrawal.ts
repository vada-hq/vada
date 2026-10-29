import type { TestPg } from '../db/test-db.js'

// 탈퇴 시험이 같이 쓰는 로그인 자료. 사람마다 세션·알림 기기·Google 계정 행·동의 기록을 하나씩 둔다.
// 다른 학생회와 같은 학생회의 다른 사람에게도 같은 모양으로 두어, 대상 거르기를 지우면 시험이 실패하게 한다.

export const sessionIdOf = (userId: string) => `${userId}:session`

export async function seedLogins(pg: TestPg, userIds: readonly string[], createdAt: Date) {
  for (const userId of userIds) {
    await pg.query(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4::timestamptz + interval '7 days', $4, '203.0.113.7', 'Test Browser')`,
      [sessionIdOf(userId), userId, `${userId}-token`, createdAt.toISOString()],
    )
    await pg.query(
      `INSERT INTO push_device (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, 'p256dh-key', 'auth-key')`,
      [userId, `https://fcm.googleapis.com/fcm/send/${userId}`],
    )
    await pg.query(
      `INSERT INTO accounts (id, user_id, account_id, provider_id) VALUES ($1, $2, $3, 'google')`,
      [`${userId}:account`, userId, `google-${userId}`],
    )
    await pg.query(
      `INSERT INTO terms_agreement (user_id, terms_version, privacy_version)
       VALUES ($1, '2026-11-01', '2026-11-01')`,
      [userId],
    )
  }
}

// 사람 하나에 남은 것의 개수. 탈퇴하면 로그인 쪽은 모두 0이고, 동의 기록은 탈퇴한 시각이 적힌 채 남는다.
export async function traceOf(pg: TestPg, userId: string, memberId: string) {
  const { rows } = await pg.query<Record<string, number>>(
    `SELECT
      (SELECT count(*)::int FROM users WHERE id = $1) AS users,
      (SELECT count(*)::int FROM sessions WHERE user_id = $1) AS sessions,
      (SELECT count(*)::int FROM push_device WHERE user_id = $1) AS devices,
      (SELECT count(*)::int FROM accounts WHERE user_id = $1) AS accounts,
      (SELECT count(*)::int FROM member_login WHERE member_id = $2) AS logins,
      (SELECT count(*)::int FROM terms_agreement WHERE user_id = $1 AND withdrawn_at IS NULL) AS agreed,
      (SELECT count(*)::int FROM terms_agreement WHERE user_id = $1 AND withdrawn_at IS NOT NULL) AS withdrawn_agreements,
      (SELECT count(*)::int FROM council_membership WHERE member_id = $2 AND ends_at IS NULL) AS memberships,
      (SELECT count(*)::int FROM department_membership WHERE member_id = $2 AND ends_at IS NULL) AS placements,
      (SELECT count(*)::int FROM record_version WHERE record_id = $2
         AND (data ->> 'name' IS NOT NULL OR data ->> 'email' IS NOT NULL)) AS named_versions,
      (SELECT count(*)::int FROM room_membership WHERE member_id = $2) AS seats,
      (SELECT count(*)::int FROM left_room_read WHERE member_id = $2) AS kept_reads,
      (SELECT count(*)::int FROM member WHERE id = $2 AND left_at IS NOT NULL) AS departed`,
    [userId, memberId],
  )
  return rows[0]!
}

// 시험 DB 전체의 개수. 막힌 탈퇴가 아무것도 바꾸지 않았는지 본다.
type WholeState = Record<
  | 'users'
  | 'sessions'
  | 'devices'
  | 'accounts'
  | 'logins'
  | 'agreed'
  | 'memberships'
  | 'placements'
  | 'versions'
  | 'present'
  | 'seats',
  number
>
export async function wholeStateOf(pg: TestPg) {
  const { rows } = await pg.query<WholeState>(
    `SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM sessions) AS sessions,
      (SELECT count(*)::int FROM push_device) AS devices,
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM member_login) AS logins,
      (SELECT count(*)::int FROM terms_agreement WHERE withdrawn_at IS NULL) AS agreed,
      (SELECT count(*)::int FROM council_membership WHERE ends_at IS NULL) AS memberships,
      (SELECT count(*)::int FROM department_membership WHERE ends_at IS NULL) AS placements,
      (SELECT count(*)::int FROM record_version) AS versions,
      (SELECT count(*)::int FROM member WHERE left_at IS NULL) AS present,
      (SELECT count(*)::int FROM room_membership) AS seats`,
  )
  return rows[0]!
}
