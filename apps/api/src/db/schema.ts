import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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

/**
 * 지금 열려 있는 로그인. **Better Auth가 이 표를 쓴다.**
 *
 * 세션을 표에 두는 까닭은 **끊을 수 있어야** 하기 때문이다 — 쿠키에만 있으면 잃어버린
 * 기기에서 로그아웃시킬 방법이 없다. 개인정보를 다루는 서비스에서 그것은 요구사항이다.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user').on(table.userId)],
)

/**
 * 어느 길로 들어왔는가(구글·카카오).
 *
 * **비밀번호를 다루지 않기로 했으므로** `password`는 늘 비어 있다. 저장할 것이 없으면
 * 샐 것도 없다 — 그 자리는 Better Auth가 요구해서 있을 뿐이다.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    issuer: text('issuer'),
    accountId: text('account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_user').on(table.userId),
    // 같은 길로 같은 사람이 두 번 들어오지 않는다.
    unique('accounts_provider_account').on(table.providerId, table.accountId),
  ],
)

/** 확인 중인 것. Better Auth가 쓴다. */
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
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
    /**
     * 이 부서가 재정을 맡는가.
     *
     * 권한 행렬의 '재정부만'을 판정하는 유일한 근거다. **부서 이름으로 보지 않는다** —
     * 학생회마다 이름이 다르고(재무부·회계국) 이름을 바꾸면 권한이 조용히 사라진다.
     *
     * **명세에 이것을 켜는 자리가 아직 없다.** 조직을 만들거나 고치는 화면에 그 자리를
     * 새로 만들어야 한다(2026-08-30 결정).
     */
    handlesFinance: boolean('handles_finance').notNull().default(false),
  },
  (table) => [
    uniqueIndex('departments_org_name').on(table.orgId, table.name),
    // **다른 표가 '같은 조직의 그 부서'를 가리킬 수 있게 한다.**
    // id만 가리키면 남의 조직 부서를 가리키는 것을 아무것도 막지 못한다.
    //
    // 인덱스가 아니라 **제약**이다 — 인덱스로 두면 표를 만든 뒤에 생기는데
    // 그것을 가리키는 외래 키가 먼저 나와 깨진다.
    unique('departments_org_id').on(table.orgId, table.id),
  ],
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
    /**
     * 회장단 안에서의 자리. **'회장'·'부회장'처럼 그림이 그린 말이다.**
     *
     * 역할(role)이 chair 하나인데 조직도(ORG-03A)는 회장과 부회장을 다른 색으로
     * 갈라 그린다 — 권한은 같고 자리 이름만 다르다. 권한 행렬에 넣으면 역할이
     * 넷이 되어 '역할은 셋으로 고정'이 깨지므로 여기 따로 둔다.
     *
     * 회장단이 아닌 사람에게는 없다.
     */
    executiveTitle: text('executive_title'),
    // 부서에 아직 안 든 사람이 있다(org.unassignedMembers). 그래서 비워 둘 수 있다.
    //
    // **가리키는 것은 부서가 아니라 '이 조직의 그 부서'다.** id만 가리켰더니 남의
    // 조직 부서를 가리킬 수 있었고, 그러면 조직도가 남의 사람을 그렸다 —
    // 이어 붙인 표가 자기 조직을 확인하지 않았기 때문이다(2026-08-31 교차검토).
    // 손으로 거르는 것은 자리마다 잊을 수 있으므로 표가 막는다.
    departmentId: text('department_id'),
    // 부서장인가. 부서마다 여럿일 수 있다(org.departments의 leaders가 배열이다).
    isDepartmentLeader: boolean('is_department_leader').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('members_org').on(table.orgId),
    index('members_department').on(table.departmentId),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'members_department_same_org',
    }).onDelete('set null'),
    // 다른 표가 '이 조직의 그 사람'을 가리킬 수 있게.
    unique('members_org_id').on(table.orgId, table.id),
  ],
)

// **권한 행렬 표가 있었는데 없앴다.** 조직마다 한 벌씩 저장하고 있었다.
//
// 그런데 그 표를 바꾸는 화면도 변이도 명세에 없다 — ORG-04은 보여주기만 한다.
// 2026-08-30에 사람이 '모든 학생회가 같은 표를 쓴다'로 정했다. 고정인 것을 조직마다
// 저장하면 조직이 늘 때마다 같은 열세 줄이 늘고, 규칙을 고칠 때 이미 만들어진
// 조직들은 옛 규칙을 든 채 남는다.
//
// 규칙은 `specs/figma/vada-wireframe/permissions.json`에 있고 `src/permissions.ts`가
// 판정한다. ORG-04이 그리는 표도 거기서 나온다 — **표는 정책의 그림이다.**
// 나중에 학생회마다 다르게 하려면 그때 표를 데이터로 옮기면 되고, 그 방향은 싸다.

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

// ─── 행사 ───────────────────────────────────────────────────────────────────

/**
 * 행사의 진행 단계.
 *
 * **화면에 그려지는 것은 이 값이 아니다.** 서버가 '기획 중' 같은 말과 색으로 바꿔
 * 준다 — 단계 이름과 색의 규칙이 화면에 박히면 규칙이 바뀔 때마다 화면을 고쳐야 한다.
 * 화면이 이 열쇠를 받는 자리가 하나 있는데(작업공간 갈피의 갈림), 그것은 **그려지지
 * 않고 어디로 갈지만 정한다**(event.workspace.statusKey).
 */
export const eventStatus = pgEnum('event_status', [
  'planning',
  'inProgress',
  'wrapUp',
  'done',
])

/**
 * 참가비를 어떻게 받는가(EVT-02B).
 *
 * **목록은 `specs/figma/vada-wireframe/option-sources.json`의 `event.feeTypes`가 정한다.**
 * 그림에 고정된 넷이고 학생회가 늘리는 자리가 없다 — 그래서 값이지 표가 아니다.
 * 여기 다시 적는 까닭은 옮김 파일이 글자 그대로를 필요로 하기 때문이고, 두 벌이
 * 갈리지 않게 검사가 명세와 견준다(`basics.test.ts`).
 */
export const eventFeeType = pgEnum('event_fee_type', [
  'free',
  'fixed',
  'duesConditional',
  'undecided',
])

/** 정원을 어떻게 두는가(EVT-02B). `event.capacityTypes`가 정한 셋. */
export const eventCapacityType = pgEnum('event_capacity_type', [
  'unlimited',
  'limited',
  'undecided',
])

/**
 * 행사.
 *
 * **행사명 하나로 만들어진다**(EVT-00B). 나머지는 행사 공간에서 나중에 채우므로
 * 거의 전부 비어 있을 수 있고, 비어 있을 때 무엇을 보일지는 **서버가 완성한 글**로
 * 준다('일시 미정'·'장소 미정'). 여기 빈 글을 저장해 두지 않는다 — 저장하면
 * '아직 안 정했다'와 '비워 두기로 했다'가 같은 모양이 된다.
 */
export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: eventStatus('status').notNull().default('planning'),
    // 행사 소개와 목적·주요 내용. 여러 줄이다(EVT-02B가 둘 다 multiline으로 받는다).
    intro: text('intro'),
    purpose: text('purpose'),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    /**
     * 종료 시간을 **정하지 않기로 했는가.**
     *
     * `endAt`이 비어 있는 것과 다른 사실이다 — 비어 있는 것은 '아직 안 적었다'이고
     * 이것은 '안 정하기로 했다'다. 표 머리가 적어 둔 것과 같은 갈림이고, EVT-02B가
     * 그 둘을 **다른 칸**으로 받으므로(체크상자) 여기서도 갈라 둔다.
     */
    endUnset: boolean('end_unset').notNull().default(false),
    place: text('place'),
    /** 장소를 정하지 않기로 했는가. `endUnset`과 같은 까닭. */
    placeUnset: boolean('place_unset').notNull().default(false),
    address: text('address'),
    placeDetail: text('place_detail'),
    audience: text('audience'),
    // 참가비는 조건까지 문장이다('납부자 무료 / 미납자 500원') — 값 하나로 쪼갤 수
    // 있는지 그림이 말하지 않으므로 사람이 적은 그대로 둔다.
    fee: text('fee'),
    /**
     * 참가비를 **칸으로 쪼갠 것**(EVT-02B). 위의 `fee`와 같은 사실의 다른 모습이다.
     *
     * 두 벌이 함께 있는 까닭: `fee`는 사람이 적은 **한 줄**이고 EVT-02와 밖의 신청
     * 폼이 그것을 읽는다. 여기는 **고칠 칸 하나하나**다. 칸에서 한 줄을 만드는 규칙을
     * 명세가 끝까지 말하지 않는다 — `duesConditional`은 '납부자 무료 / 미납자 5000원'으로
     * 잇는다고 적혀 있지만 `fixed`가 어느 금액을 쓰는지는 어디에도 없다. 지어내지 않고
     * 갈라 둔다. **잇는 일은 그 규칙이 명세에 생기는 날 한 자리에서 한다.**
     */
    feeType: eventFeeType('fee_type').notNull().default('undecided'),
    paidAmount: integer('paid_amount'),
    unpaidAmount: integer('unpaid_amount'),
    payGuide: text('pay_guide'),
    capacity: text('capacity'),
    capacityType: eventCapacityType('capacity_type').notNull().default('undecided'),
    /**
     * 정원 **인원 수**. 위의 `capacity`가 사람이 적은 한 줄('200명')이라 따로 둔다 —
     * 그 줄을 수 칸에 되돌려 줄 수 없다('제한 없음'이라고 적혀 있을 수도 있다).
     */
    capacityCount: integer('capacity_count'),
    contact: text('contact'),
    /** 참가자에게 미리 알릴 것(EVT-02B). 참여 설문 안내에 반영된다고 그림이 적었다. */
    notice: text('notice'),
    // 맡은 부서와 사람. 둘 다 없을 수 있다(담당 미정).
    //
    // 구성원과 같은 까닭으로 **'이 조직의' 부서와 사람**을 가리킨다.
    hostDepartmentId: text('host_department_id'),
    hostMemberId: text('host_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_org_status').on(table.orgId, table.status),
    // 다른 표가 '이 조직의 그 행사'를 가리킬 수 있게. QR과 설문이 그것을 가리킨다.
    unique('events_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.hostDepartmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'events_host_department_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.hostMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'events_host_member_same_org',
    }).onDelete('set null'),
  ],
)

// ─── 밖에서 오는 사람 ───────────────────────────────────────────────────────
//
// **로그인이 없는 자리다.** QR로 온 참석자와 링크로 온 설문 응답자가 여기 남는다.
// 주소가 실어 온 토큰이 유일한 열쇠이므로 표가 세 가지를 지켜야 한다.
//
// 1. **토큰을 그대로 저장하지 않는다.** 해시로 둔다 — 표가 새면 그 값으로 남의 것을
//    열 수 있다. 로그나 백업으로 새는 길이 표보다 넓다.
// 2. **같은 사람이 두 번 내는 것을 표가 막는다.** 손으로 세면 두 요청이 동시에 올 때
//    둘 다 통과한다.
// 3. **영수증은 사람마다 다르다.** 공유 토큰으로 결과를 열면 뒤에 낸 사람이 앞사람의
//    이름과 납부 상태를 본다(첫 교차검토가 찾은 구멍이다).

/** QR 하나. 다시 만들면 옛 것이 죽는다(event.attendanceQr.regenerate). */
export const attendanceQrs = pgTable(
  'attendance_qrs',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    eventId: text('event_id').notNull(),
    /** **토큰 자체가 아니라 그 해시다.** 표가 새도 QR이 열리지 않는다. */
    tokenHash: text('token_hash').notNull().unique(),
    active: boolean('active').notNull().default(true),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('attendance_qrs_event').on(table.eventId),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'attendance_qrs_event_same_org',
    }).onDelete('cascade'),
  ],
)

/**
 * 찍힌 참석 하나.
 *
 * **한 사람이 한 번이다.** `(qrId, studentNumber)`를 표가 유일하게 지킨다 —
 * 두 요청이 동시에 와도 하나만 남는다. 막혔을 때 **영수증을 돌려주지 않는다**:
 * 학번은 아무나 적을 수 있는 값이고 영수증은 그 사람만 가져야 하는 값이라,
 * 앞의 것으로 뒤의 것을 가리면 남의 것을 여는 열쇠가 된다(2026-08-31 교차검토).
 */
export const attendanceCheckIns = pgTable(
  'attendance_check_ins',
  {
    id: text('id').primaryKey(),
    qrId: text('qr_id')
      .notNull()
      .references(() => attendanceQrs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    studentNumber: text('student_number').notNull(),
    /** 이 사람의 결과를 여는 열쇠. **해시로 둔다.** */
    receiptHash: text('receipt_hash').notNull().unique(),
    /** 영수증이 언제까지 듣는가. 오래 사는 열쇠는 오래 새는 열쇠다. */
    receiptExpiresAt: timestamp('receipt_expires_at', { withTimezone: true }).notNull(),
    /** 명단에 있는 사람인가. 없으면 다시 낼 수 있다(canRetry). */
    matched: boolean('matched').notNull().default(false),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('attendance_once_per_student').on(table.qrId, table.studentNumber)],
)

/** 설문 하나. 교체하면 옛 것이 죽고 새 것을 가리킨다. */
export const surveys = pgTable(
  'surveys',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    eventId: text('event_id').notNull(),
    /**
     * 링크가 실어 오는 값. **여기만 그대로 둔다.**
     *
     * 다른 열쇠는 해시로 두는데(영수증·QR) 이것만 원문인 까닭이 둘이다.
     *
     * 1. **뿌리는 값이다.** 단톡방과 포스터에 붙는 링크이고, 표가 새기 전에 이미
     *    공개다. 이것으로 할 수 있는 일은 신청을 내는 것뿐이며 남의 것을 읽는 것은
     *    영수증만 한다.
     * 2. **계약이 되돌리기를 요구한다.** 설문을 교체하면 옛 링크가 새 설문의 토큰을
     *    답해야 하는데(`survey.linkState.replacementToken`), 해시는 되돌릴 수 없다.
     *
     * 그러니 이 자리가 느슨한 것이 아니라 **성격이 다른 값**이다. 영수증을 여기에
     * 섞으면 안 된다.
     */
    linkToken: text('link_token').notNull().unique(),
    active: boolean('active').notNull().default(false),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    capacity: integer('capacity'),
    /** 신청 완료 화면의 제목. 운영진이 설문마다 적는다(EVT-05). */
    completionTitle: text('completion_title'),
    /** 학생회비 납부 여부를 대조하는가. 대조가 끝나야 금액이 정해지는 행사가 있다. */
    duesCheck: boolean('dues_check').notNull().default(false),
    /**
     * 이 설문을 대신하는 새 설문. 교체된 설문에만 있다.
     *
     * **가리키는 것이 곧 폐기는 아니다.** 옛 링크를 가진 사람이 새 설문으로 갈 수
     * 있게 하는 것이 이 값의 뜻이고, 옛 설문 자체는 `active`가 거짓이 되어 닫힌다.
     */
    replacedById: text('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('surveys_event').on(table.eventId),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'surveys_event_same_org',
    }).onDelete('cascade'),
  ],
)

/** 낸 신청 하나. 참석과 같은 규칙을 따른다. */
export const surveyApplications = pgTable(
  'survey_applications',
  {
    id: text('id').primaryKey(),
    surveyId: text('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    studentNumber: text('student_number').notNull(),
    college: text('college'),
    department: text('department'),
    grade: text('grade'),
    motivation: text('motivation'),
    receiptHash: text('receipt_hash').notNull().unique(),
    receiptExpiresAt: timestamp('receipt_expires_at', { withTimezone: true }).notNull(),
    /**
     * 동의를 **언제** 했는가. 참거짓이 아니라 시각을 남긴다.
     *
     * 법이 요구하는 것은 '동의를 받았다'가 아니라 '언제 받았는지 증명할 수 있는가'다.
     * 참거짓만 두면 나중에 그것이 언제 켜졌는지 아무도 모른다.
     */
    privacyConsentAt: timestamp('privacy_consent_at', { withTimezone: true }).notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('survey_once_per_student').on(table.surveyId, table.studentNumber)],
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
    // **가리키지 않는다.** 조직이나 사람이 지워져도 남아야 한다 — 보관 기간이
    // 1년인데 삭제 한 번에 '누가'가 사라지면 기준이 요구하는 식별자가 없는 기록이
    // 된다(2026-08-31 교차검토). 권한 변경 기록에 먼저 쓴 방식과 같다.
    orgId: text('org_id'),
    // 로그인하지 않은 사람도 남는다 — QR로 온 참석자가 그렇다.
    userId: text('user_id'),
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
    // 같은 까닭으로 가리키지 않는다. 3년을 지키라는 요구가 사용자 삭제 한 번에
    // 무너지면 안 된다.
    actorUserId: text('actor_user_id'),
    /** 그때 그 사람이 누구였는지. 가리키는 줄이 사라져도 남는다. */
    actorName: text('actor_name'),
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
