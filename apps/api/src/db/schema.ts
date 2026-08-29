import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// 테이블은 **사실만 담는다.**
//
// 카탈로그의 조각 890개를 갈라 보니 43%가 컬럼이 아니었다 — 서버가 만드는 완성된
// 글 195, 색 이름 69, 센 값 40, 판정 17. `memberCountLabel`('부원 2명')은 저장하는
// 값이 아니라 세어서 말로 만든 것이고, `roleTone`('violet')은 표현이다.
//
// 그래서 읽는 자리 145개와 테이블 수는 아무 상관이 없다. 여기 있는 것은 **저장해야
// 없어지지 않는 것**뿐이고, 나머지는 읽을 때 만든다.
//
// 이 파일은 조직 층까지다. 행사·회의·업무·재정·기록·메시지는 같은 방식으로 이어
// 붙인다 — 근거 없이 컬럼을 지어내지 않는 것이 규칙이다.

// ─── 값의 갈래 ──────────────────────────────────────────────────────────────
//
// **역할은 테이블이 아니라 값이다.** 권한 행렬(org.permissionMatrix)의 열이
// chair·head·member 셋으로 고정이고, 역할 수(org.roleCounts)도 그 셋을 센다.
// 학생회가 역할을 새로 만드는 화면은 어디에도 없다 — 있으면 그때 테이블이 된다.
export const memberRole = pgEnum('member_role', ['chair', 'head', 'member'])

// 학생회비 납부 상태. 개발용 응답의 DUES_BY_STATUS가 그대로 이 셋이다.
export const duesStatus = pgEnum('dues_status', ['paid', 'unpaid', 'check'])

// 권한 행렬의 한 칸. 화면은 이것을 글과 색으로 바꿔 그린다.
export const permissionLevel = pgEnum('permission_level', ['full', 'partial', 'none'])

// ─── 사람과 조직 ────────────────────────────────────────────────────────────

/**
 * 로그인한 사람. **Better Auth가 이 표를 쓴다.**
 *
 * 학적 정보(이름·학번·학과)는 여기 두지 않는다 — 그것은 **어느 학생회의 구성원인가**에
 * 딸린 사실이고, 한 사람이 여러 학생회에 속할 수 있다(ONB-02가 '새로 만들기'와
 * '초대받아 참여하기'를 나란히 둔다).
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  // org.invitedOrganization이 초대장에서 보여 주는 넷.
  name: text('name').notNull(),
  kind: text('kind'),
  scope: text('scope'),
  term: text('term'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const departments = pgTable(
  'departments',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // 조직도가 그리는 차례. 이름순이 아니다 — 사람이 정한 순서가 있다(ORG-03B가
    // 부서를 끌어 옮긴다).
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [uniqueIndex('departments_org_name').on(table.orgId, table.name)],
)

/**
 * 학생회의 구성원.
 *
 * **학번은 개인정보다.** 저장 암호화는 RDS가 주고, 그 위에 한 겹 더 둘지는
 * 아직 정하지 않았다(docs/decisions/backend-architecture.md).
 *
 * `userId`가 비어 있을 수 있다 — 학생회가 명단을 먼저 만들고 사람이 나중에
 * 로그인해 붙는 경우가 있다(초대 코드로 들어오는 길이 그것이다).
 */
export const members = pgTable(
  'members',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    studentNumber: text('student_number'),
    college: text('college'),
    major: text('major'),
    grade: text('grade'),
    role: memberRole('role').notNull().default('member'),
    // 부서에 아직 안 든 사람이 있다(org.unassignedMembers). 그래서 비워 둘 수 있다.
    departmentId: text('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    // 부서장인가. 부서마다 여럿일 수 있다(org.departments의 leaders가 배열이다).
    isDepartmentLeader: boolean('is_department_leader').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('members_org').on(table.orgId),
    index('members_department').on(table.departmentId),
  ],
)

/**
 * 권한 행렬의 한 줄. 기능 영역 하나가 역할 셋에 대해 각각 어디까지 되는가.
 *
 * 화면(ORG-04)은 이것을 표로 그리고 색을 입힌다 — 색은 여기 없다.
 */
export const permissions = pgTable(
  'permissions',
  {
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    area: text('area').notNull(),
    role: memberRole('role').notNull(),
    level: permissionLevel('level').notNull(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.area, table.role] })],
)

/**
 * 초대 코드. 코드 하나가 학생회 하나를 가리킨다(INV-00 → INV-01).
 *
 * 다시 만들면 옛 코드가 죽는다(org.invite의 regeneratedNote가 그 사실을 말한다).
 */
export const invites = pgTable(
  'invites',
  {
    code: text('code').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    regeneratedAt: timestamp('regenerated_at', { withTimezone: true }),
  },
  (table) => [index('invites_org').on(table.orgId)],
)

/**
 * 학생 명단. **구성원이 아니다** — 학생회 밖의 학생이고, 학생회비를 냈는지를 본다.
 *
 * ORG-07A가 이 목록을 그리고 ORG-07B·07C가 파일로 갈아 끼운다.
 */
export const students = pgTable(
  'students',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    studentNumber: text('student_number').notNull(),
    college: text('college'),
    department: text('department'),
    grade: text('grade'),
    duesStatus: duesStatus('dues_status').notNull().default('unpaid'),
  },
  (table) => [
    uniqueIndex('students_org_number').on(table.orgId, table.studentNumber),
    index('students_org_dues').on(table.orgId, table.duesStatus),
  ],
)

/**
 * 명단과 납부 상태를 **언제 누가** 갈아 끼웠는가(org.rosterScope).
 *
 * 둘이 따로 온다 — 명단은 학사 일정에 맞춰 바뀌고 납부는 학기 중에 계속 바뀐다.
 */
export const rosterUpdates = pgTable(
  'roster_updates',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByMemberId: text('updated_by_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('roster_updates_org_kind').on(table.orgId, table.kind)],
)

// ─── 법이 요구하는 기록 ─────────────────────────────────────────────────────

/**
 * 개인정보처리시스템 접속 기록. **1년 이상 보관한다.**
 *
 * 5만 명 미만이라 1년이다(개인정보의 안전성 확보조치 기준). 나중에 붙이는 것이
 * 훨씬 비싸므로 첫 테이블부터 둔다 — 지난 일은 소급해 기록할 수 없다.
 *
 * 재정 승인 워크플로가 있으니 "누가 무엇을 언제 승인했는가"는 어차피 도메인의
 * 요구이기도 하다. 법과 도메인이 같은 것을 요구하는 드문 자리다.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    orgId: text('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    // 로그인하지 않은 사람도 남는다 — QR로 온 참석자가 그렇다.
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    // **누구의 정보를 다뤘는가.** 기준이 요구하는 것은 '누가 접속했나'만이 아니다 —
    // 이 자리가 비면 새어 나간 뒤에 누구의 것이 새었는지 알 수 없다.
    subjectType: text('subject_type'),
    subjectId: text('subject_id'),
    // 터진 요청도 남는다. 막힌 시도가 오히려 봐야 할 것이다.
    failed: boolean('failed').notNull().default(false),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => [index('audit_logs_at').on(table.at), index('audit_logs_org_at').on(table.orgId, table.at)],
)

/**
 * 권한을 주고 바꾸고 없앤 기록. **3년 보관한다.**
 *
 * 접속 기록과 따로 두는 까닭은 보관 기간이 다르기 때문이다 — 같은 표에 담으면
 * 1년치를 지울 때 3년치가 함께 지워지거나, 3년을 지키려고 1년치를 3년 들고 있게
 * 된다.
 */
export const permissionChanges = pgTable(
  'permission_changes',
  {
    id: text('id').primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    // **조직과 함께 지워지지 않는다.** cascade로 두었더니 조직을 지우는 순간
    // 3년치가 함께 사라졌다 — 보관 기간을 지키라는 요구가 삭제 한 번에 무너진다.
    // 조직이 없어져도 '누가 언제 누구의 권한을 바꿨는가'는 남아야 한다.
    orgId: text('org_id').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    // 같은 까닭으로 구성원이 지워져도 남는다. 누구였는지는 이름을 함께 적어 둔다 —
    // 가리키는 줄이 사라지면 기록이 '누구인지 모르는 변경'이 된다.
    subjectMemberId: text('subject_member_id'),
    subjectName: text('subject_name'),
    change: text('change').notNull(),
    before: text('before'),
    after: text('after'),
  },
  (table) => [index('permission_changes_org_at').on(table.orgId, table.at)],
)
