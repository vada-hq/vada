import {
  boolean,
  foreignKey,
  index,
  date,
  integer,
  jsonb,
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
// 조직 층 위에 행사·회의·업무·재정·기록을 같은 방식으로 이어 붙였다 —
// **근거 없이 컬럼을 지어내지 않는 것이 규칙이다.** 그래서 안 지은 것이 있다:
//
// - **메시지 방과 대화**(MSG-01·02·03). 명세가 조각을 하나도 주지 않는다 —
//   와이어프레임이 방이 하나도 없는 모습만 그렸고 채워진 목록은 어느 화면에도
//   없다. `message.rooms`의 조각은 `id` 하나뿐이다. 표를 지으면 전부 지어낸 것이다.
// - **발행된 아카이브의 본문**(REC-02의 열세 조각·회고·인수인계 줄·체크리스트).
//   **발행하는 동작이 명세에 없다** — `record.archive.requestReview`가 '발행이
//   아니다'라고 못 박고 있고 발행 단추는 그려지지 않았다. 없는 동작을 전제한
//   표는 지어낸 것이다(`org.duesTerms`에서 표를 안 만든 것과 같은 근거다).
// - **달력과 행사 일정**(OPS-CAL-01·EVT-SCHED-01). 명세가 '원본이 아니라 비친
//   것'이라고 적었다 — 업무 마감·회의 일시·행사 기본정보가 각자 원본이고 이
//   목록은 그것을 모아 온다. 담을 사실이 없다.
// - **품목 카테고리·구매 유형·우선순위·회의 진행 방식**. 명세가 '조직이 정한다'고
//   적었지만 그것을 관리하는 화면이 어디에도 없다. 조직마다 갈리는 것이 실제로
//   드러나는 날 표가 된다.

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

// ─── 학교의 편제 ────────────────────────────────────────────────────────────
//
// **`departments`라는 이름은 이미 쓰였다.** 그것은 학생회가 스스로 나눈 부서
// (재정부·기획부)이고 여기 있는 것은 **학교의 학부·학과**다. 카탈로그가 그 둘을
// `org.departments`와 `education.departments`로 갈라 부르며 "다른 물건이다"라고
// 적어 두었으므로, 표 이름도 **카탈로그의 그 이름을 그대로** 쓴다 —
// `education_schools` · `education_colleges` · `education_departments`.
//
// `majors`나 `academic_departments` 같은 새 이름을 짓지 않는 까닭: 명세가 그렇게
// 부르지 않는다. 이름을 새로 지으면 명세와 표 사이에 옮겨 적는 자리가 하나 더
// 생기고, 옮겨 적는 자리는 언젠가 갈린다.
//
// **지금 든 것은 한 학교뿐이다**(옮김 파일이 넣는다). 전국의 편제를 지어내 채우지
// 않는다 — 그것은 학교알리미 같은 공시 자료에서 와야 하고, 지어낸 목록은 사람이
// 자기 학과를 못 찾는 순간 거짓으로 드러난다.

export const educationSchools = pgTable(
  'education_schools',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
  },
  (table) => [uniqueIndex('education_schools_name').on(table.name)],
)

export const educationColleges = pgTable(
  'education_colleges',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => educationSchools.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (table) => [
    uniqueIndex('education_colleges_school_name').on(table.schoolId, table.name),
    // **다른 표가 '그 학교의 그 단과대'를 가리킬 수 있게 한다.** id만 가리키면
    // 남의 학교의 단과대가 붙는 것을 아무것도 막지 못한다 — `members`가 부서를
    // 가리킬 때와 같은 길이다(2026-08-31에 그 구멍이 실제로 났다).
    unique('education_colleges_school_id').on(table.schoolId, table.id),
  ],
)

export const educationDepartments = pgTable(
  'education_departments',
  {
    id: text('id').primaryKey(),
    // 학교를 함께 든다. 아래 복합 외래 키가 이 둘을 함께 봐야 하기 때문이다 —
    // 단과대만 가리키면 '어느 학교의 단과대인가'를 표가 다시 확인할 수 없다.
    schoolId: text('school_id').notNull(),
    collegeId: text('college_id').notNull(),
    name: text('name').notNull(),
  },
  (table) => [
    uniqueIndex('education_departments_college_name').on(table.collegeId, table.name),
    foreignKey({
      columns: [table.schoolId, table.collegeId],
      foreignColumns: [educationColleges.schoolId, educationColleges.id],
      name: 'education_departments_college_same_school',
    }).onDelete('cascade'),
  ],
)

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /**
     * 어떤 학생회인가. **그려지는 글이 아니라 `org.types`의 값이다**('college').
     *
     * 딱지('단과대 학생회')를 저장하면 명세가 그 말을 다듬을 때 이미 만들어진
     * 학생회들만 옛 말을 든 채 남는다. 값에서 말을 만드는 일은 읽을 때 한다.
     */
    kind: text('kind'),
    /** 운영 연도. 같은 까닭으로 `org.operatingYears`의 값이다('2026'). */
    term: text('term'),
    /**
     * 대표 범위. **글이 아니라 가리킴이다.**
     *
     * 한동안 `scope` 열 하나에 '한양대학교 ERICA · 소프트웨어융합대학'을 담기로 되어
     * 있었는데, 그것은 **세어서 이어 붙인 글**이라 표에 둘 것이 아니다(이 파일 머리가
     * 말하는 그것이다). 학교 이름이 바뀌면 그 글만 옛것으로 굳고, 이어 붙이는 규칙도
     * 표에 박힌다. 그래서 가리키고 읽을 때 잇는다.
     *
     * 비어 있을 수 있다 — 이 두 열이 생기기 전에 만들어진 학생회가 있다.
     */
    repSchoolId: text('rep_school_id').references(() => educationSchools.id, {
      onDelete: 'set null',
    }),
    repCollegeId: text('rep_college_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // **그 학교의 그 단과대여야 한다.** 둘을 따로 가리키면 한양대 아래에 옆 학교의
    // 단과대가 붙고, 초대장이 있지도 않은 범위를 대표한다고 말한다.
    foreignKey({
      columns: [table.repSchoolId, table.repCollegeId],
      foreignColumns: [educationColleges.schoolId, educationColleges.id],
      name: 'organizations_rep_college_same_school',
    }).onDelete('set null'),
  ],
)

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
    /**
     * 누가 갈아 끼웠는가.
     *
     * **그 학생회의 구성원이어야 한다.** 사람만 따로 가리켰더니 남의 학생회 사람이
     * 우리 명단의 갱신자로 붙을 수 있었다 — 화면은 그 이름을 '학생 명단 업로드 ·
     * 아무개'로 그대로 그린다. 표 열다섯 개를 한꺼번에 지으면서 이음매 검사를
     * 세웠고, 그때 이 한 자리가 걸렸다(2026-09-04).
     */
    updatedByMemberId: text('updated_by_member_id'),
  },
  (table) => [
    index('roster_updates_org_kind').on(table.orgId, table.kind),
    foreignKey({
      columns: [table.orgId, table.updatedByMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'roster_updates_member_same_org',
    }).onDelete('set null'),
  ],
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
 * 참여 설문을 선착순으로 받는가 승인제로 받는가. `event.surveyApplyMethods`가 정한 둘.
 */
export const surveyApplyMethod = pgEnum('survey_apply_method', ['firstCome', 'approval'])

/**
 * 신청이 받아들여졌는가.
 *
 * **디자인이 그린 딱지가 둘이다**(EVT-04: '신청 완료'·'대기 중'). 승인제에서 승인
 * 전은 '대기 중'이고 선착순에서 정원 초과도 '대기 중'이다 — 무엇을 뜻하는지는
 * 설문의 신청 방식이 정하므로 값이 둘로 족하다.
 */
export const applyStatus = pgEnum('apply_status', ['applied', 'waitlisted'])

/** 참가비를 냈는가. 디자인이 그린 셋('납부 확인'·'미납'·'미확인'). */
export const payStatus = pgEnum('pay_status', ['unknown', 'paid', 'unpaid'])

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
     * 선착순인가 승인제인가(`event.surveyApplyMethods`).
     *
     * **신청 상태의 뜻이 이것에 달렸다** — 선착순에서 '대기 중'은 정원이 찼다는
     * 뜻이고 승인제에서는 아직 승인 전이라는 뜻이다. 같은 값이 다른 사실을
     * 가리키므로 어느 쪽인지를 설문이 들고 있어야 한다.
     */
    applyMethod: surveyApplyMethod('apply_method').notNull().default('firstCome'),
    /** 정원이 넘치면 대기 신청을 받는가. 안 받으면 정원에서 끊긴다. */
    waitlist: boolean('waitlist').notNull().default(false),
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
    // 문항이 (조직, 설문)으로 이어 붙을 수 있게 한다 — 이음매마다 울타리를 다시 세운다.
    unique('surveys_org_id').on(table.orgId, table.id),
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
    /**
     * 신청이 받아들여졌는가(EVT-04의 첫 딱지).
     *
     * 뜻은 설문의 신청 방식이 정한다 — 위의 `applyMethod`를 보라.
     */
    applyStatus: applyStatus('apply_status').notNull().default('applied'),
    /**
     * 참가비를 냈는가(EVT-04의 둘째 딱지).
     *
     * **'모름'이 기본이다.** 안 냈다는 것과 아직 확인 안 했다는 것은 다른 사실이고,
     * 참가비를 안 받는 행사도 있다 — 셋을 둘로 줄이면 그 행사의 모든 줄이 '미납'이 된다.
     */
    payStatus: payStatus('pay_status').notNull().default('unknown'),
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

// ─── 회의 ────────────────────────────────────────────────────────────────────

/** 정기·상시 회의인가, 행사에 걸린 회의인가. `meeting.types`가 정한 둘. */
export const meetingKind = pgEnum('meeting_kind', ['regular', 'event'])

/**
 * 회의가 지금 어느 단계인가.
 *
 * **끝내면 '완료'가 아니라 '정리 중'이 된다**(OPS-MEET-D02). 회의록과 결정을 확인한
 * 뒤에 따로 정리 완료한다 — 두 단계를 하나로 합치면 '끝났는데 회의록이 없는 회의'를
 * 담을 자리가 없어진다.
 *
 * **임시 저장한 회의는 다른 참가자에게 보이지 않는다**(meeting.saveDraft). 그것도
 * 회의이므로 표를 따로 두지 않고 단계로 둔다.
 *
 * **취소는 지우는 것이 아니다**(meeting.cancel). 취소된 기록으로 남고 사유를 갖는다.
 */
export const meetingStatus = pgEnum('meeting_status', [
  'draft',
  'scheduled',
  'inProgress',
  'wrapUp',
  'done',
  'cancelled',
])

/**
 * 회의록이 어디까지 왔는가.
 *
 * **회의의 단계와 다른 축이다** — 명세가 그렇게 적었다(`meeting.detail`의 status와
 * minutesStatus가 나란히 있다). 한 열로 합치면 '진행 중인데 회의록은 정리 끝'이
 * 담기지 않는다.
 */
export const minutesStatus = pgEnum('minutes_status', ['notStarted', 'drafting', 'done'])

/** 안건 하나가 지금 어느 단계인가. 진행 중인 것은 회의마다 하나다. */
export const agendaStatus = pgEnum('agenda_status', ['pending', 'current', 'done'])

/**
 * 참석했는가.
 *
 * **'모름'이 기본이다.** 안 왔다는 것과 아직 확인 안 했다는 것은 다른 사실이고,
 * 둘을 같은 값으로 두면 회의 중에 세는 참석 인원이 틀린다.
 */
export const attendance = pgEnum('attendance', ['unknown', 'present', 'absent'])

/**
 * 회의.
 *
 * **화면 열한 장이 이 한 표를 읽는다**(OPS-MEET-03·05·06·07·08·09). 명세가 단계마다
 * 출처를 가르지 않았고, 가르면 화면이 '지금 어느 단계인가'를 알아야 한다.
 *
 * 그려지는 것 대부분은 여기 없다 — `elapsedNote`('진행 27분')는 `startedAt`과 지금이
 * 만드는 말이고, `inviteeCountNote`('참가자 8명')는 세어서 만든 말이다.
 */
export const meetings = pgTable(
  'meetings',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: meetingKind('kind').notNull().default('regular'),
    /**
     * 어느 행사의 회의인가. **비어 있을 수 있다** — 어느 행사에도 속하지 않는 회의는
     * '정기·상시 회의' 묶음으로 온다(`meeting.groups`).
     */
    eventId: text('event_id'),
    title: text('title').notNull(),
    /** 회의의 목적. OPS-MEET-02의 칸 하나이고 상세의 description이 이것이다. */
    purpose: text('purpose'),
    status: meetingStatus('status').notNull().default('scheduled'),
    minutesStatus: minutesStatus('minutes_status').notNull().default('notStarted'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    /** 끝나기로 한 때. 실제로 끝난 때(`endedAt`)와 다른 사실이다. */
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    /**
     * 어떻게 진행하는가(대면·온라인 같은 것).
     *
     * **값의 목록이 아직 없다.** 명세가 `meeting.modes`를 서버에 묻게 두었는데
     * 디자인이 펼친 목록을 그리지 않았다 — 갈래를 지어내지 않으려고 글로 둔다.
     * 목록이 정해지면 그때 값의 갈래가 된다.
     */
    mode: text('mode'),
    place: text('place'),
    onlineLink: text('online_link'),
    /** 비공개 회의인가. OPS-MEET-02의 켜고 끄는 칸. */
    isPrivate: boolean('is_private').notNull().default(false),
    /** 만든 사람. OPS-MEET-04B의 맨 위 칸(`meeting.hostOwner`)이 이 사람이다. */
    creatorMemberId: text('creator_member_id'),
    departmentId: text('department_id'),
    /** 실제로 시작하고 끝난 때. 예정과 다르고, 그 차이가 '실제 진행 시간'이다. */
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /**
     * 회의 전체를 한 덩이로 줄인 글(`meeting.minutes`).
     *
     * **없어도 정리 완료가 막히지 않는다** — 06B가 그렇게 적어 두었다.
     */
    minutesSummary: text('minutes_summary'),
    /** 그 요약을 기계가 만들어 준 때. 사람이 쓴 것과 갈라야 안내 문장을 붙일 수 있다. */
    minutesSummaryDraftedAt: timestamp('minutes_summary_drafted_at', { withTimezone: true }),
    /** 취소한 기록. 사유가 필수다(OPS-MEET-D04). */
    cancelReason: text('cancel_reason'),
    cancelledByMemberId: text('cancelled_by_member_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** 이 회의를 대신하는 회의. 취소하면서 다시 잡은 것이 있으면 가리킨다. */
    replacementMeetingId: text('replacement_meeting_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 자식 표들이 (조직, 회의)로 이어 붙일 수 있게 한다 — 이음매마다 울타리를 다시 세운다.
    unique('meetings_org_id').on(table.orgId, table.id),
    // **그 학생회의 그 행사여야 한다.** 행사만 따로 가리키면 남의 행사에 우리 회의가 걸린다.
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'meetings_event_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.creatorMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'meetings_creator_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'meetings_department_same_org',
    }).onDelete('set null'),
    index('meetings_org_status').on(table.orgId, table.status),
    index('meetings_event').on(table.eventId),
  ],
)

/**
 * 안건.
 *
 * **단계마다 갖는 것이 다르다**(`meeting.agendas`) — 예정일 때는 예상 소요를, 진행
 * 중에는 논의 내용을, 끝난 뒤에는 확정된 결정을 갖는다. 그래도 표는 하나다: 넷으로
 * 가르면 화면이 단계를 알아야 한다.
 */
export const meetingAgendas = pgTable(
  'meeting_agendas',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    meetingId: text('meeting_id').notNull(),
    /** 몇 번째 안건인가. '다음 안건'이 무엇인지를 이 차례가 정한다. */
    sortOrder: integer('sort_order').notNull().default(0),
    title: text('title').notNull(),
    description: text('description'),
    /**
     * 잡아 둔 예상 소요(분).
     *
     * 명세가 `meeting.agendaDurations`를 서버에 묻게 두었다 — 고를 수 있는 값의
     * 목록은 서버가 만들고, 표는 고른 수를 담는다.
     */
    plannedMinutes: integer('planned_minutes'),
    status: agendaStatus('status').notNull().default('pending'),
    /** 진행 중에 적히는 것과 그 끝에 확정되는 것. 둘은 다른 사실이다. */
    discussionText: text('discussion_text'),
    decisionText: text('decision_text'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    unique('meeting_agendas_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.meetingId],
      foreignColumns: [meetings.orgId, meetings.id],
      name: 'meeting_agendas_meeting_same_org',
    }).onDelete('cascade'),
    index('meeting_agendas_meeting').on(table.meetingId, table.sortOrder),
  ],
)

/**
 * 회의의 사람들.
 *
 * **03의 참가자 목록, 05의 참가 현황, 07의 참석 결과, 04B의 권한 관리 목록이 전부
 * 같은 사람들이다** — 명세가 그렇게 합쳤고(16장을 한꺼번에 보고 나서야 합칠 수
 * 있었다고 적혀 있다), 표도 하나다.
 */
export const meetingParticipants = pgTable(
  'meeting_participants',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    meetingId: text('meeting_id').notNull(),
    memberId: text('member_id').notNull(),
    /**
     * 진행 권한을 가졌는가.
     *
     * **옮기는 것이 아니라 더하는 것이다**(OPS-MEET-D03의 '권한 부여'). 만든 사람은
     * 여기 없어도 진행할 수 있다 — 그것은 `meetings.creatorMemberId`가 말한다.
     */
    isHost: boolean('is_host').notNull().default(false),
    attendance: attendance('attendance').notNull().default('unknown'),
    /**
     * 회의 요약을 확인한 때(OPS-MEET-08).
     *
     * **회의의 상태가 아니라 이 사람의 확인 상태다** — 명세가 그렇게 못 박았다.
     */
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (table) => [
    // 한 사람이 한 회의에 두 번 들어가지 않는다.
    unique('meeting_participants_once').on(table.meetingId, table.memberId),
    foreignKey({
      columns: [table.orgId, table.meetingId],
      foreignColumns: [meetings.orgId, meetings.id],
      name: 'meeting_participants_meeting_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.memberId],
      foreignColumns: [members.orgId, members.id],
      name: 'meeting_participants_member_same_org',
    }).onDelete('cascade'),
    index('meeting_participants_member').on(table.memberId),
  ],
)

// ─── 업무 ────────────────────────────────────────────────────────────────────

/**
 * 칸반의 열.
 *
 * **명세가 넷을 고정했다** — TASK-01과 EVT-TASK-01이 열마다 이 값을 인자로 박아
 * 조회한다(`planned`·`inProgress`·`review`·`done`).
 *
 * MY-01의 갈피는 셋(`my.taskTab`: todo·inProgress·done)인데 **다른 축이 아니라 묶어
 * 본 것**이다. 검토 중인 업무는 아직 안 끝났으므로 '진행 중'에 든다 — 묶는 규칙은
 * 서버가 갖는다. 표에 셋을 담으면 칸반의 넷을 못 그린다.
 */
export const taskStatus = pgEnum('task_status', ['planned', 'inProgress', 'review', 'done'])

/**
 * 업무.
 *
 * **상시 업무와 행사 업무가 같은 표다.** TASK-01은 학생회 전체를 보고 EVT-TASK-01은
 * 한 행사를 보는데, 카드에 담기는 것이 같다 — 다른 점은 무엇으로 거르느냐뿐이다.
 * 회의에서 나온 후속 업무도 여기 온다(`meeting.followUps`의 조각이 `taskId`다).
 */
export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 어느 행사의 업무인가. 비어 있으면 상시 업무다(TASK-01이 그것을 본다). */
    eventId: text('event_id'),
    /** 어느 회의에서 나온 업무인가(`meeting.followUps`). 비어 있는 것이 보통이다. */
    fromMeetingId: text('from_meeting_id'),
    /** 사람이 부르는 번호(EVT-TASK-02의 `code`). 서버가 만든다. */
    code: text('code'),
    title: text('title').notNull(),
    description: text('description'),
    /** 무엇이 되면 끝인가와 무엇을 내놓아야 하는가. EVT-TASK-02가 나란히 그린다. */
    completionCriteria: text('completion_criteria'),
    expectedOutput: text('expected_output'),
    status: taskStatus('status').notNull().default('planned'),
    /**
     * 얼마나 급한가.
     *
     * **값의 목록이 아직 없다** — 디자인이 펼친 목록을 그리지 않았다. 회의의 `mode`와
     * 같은 사정이라 같은 모양으로 둔다.
     */
    priority: text('priority'),
    departmentId: text('department_id'),
    assigneeMemberId: text('assignee_member_id'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    /** 상시 업무의 주기(TASK-01의 카드가 그린다). 행사 업무에는 없다. */
    cycle: text('cycle'),
    /**
     * 검토(EVT-TASK-02의 `task.reviewStatus`).
     *
     * **낸 것과 공식 판정이 다른 사실이다** — 화면이 딱지 둘을 나란히 그린다.
     */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    officialResult: text('official_result'),
    reviewComment: text('review_comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('tasks_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'tasks_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.fromMeetingId],
      foreignColumns: [meetings.orgId, meetings.id],
      name: 'tasks_meeting_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'tasks_department_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.assigneeMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'tasks_assignee_same_org',
    }).onDelete('set null'),
    index('tasks_org_status').on(table.orgId, table.status),
    index('tasks_event_status').on(table.eventId, table.status),
    index('tasks_assignee').on(table.assigneeMemberId),
  ],
)

// ─── 문서 ────────────────────────────────────────────────────────────────────

/** 문서가 어디까지 왔는가. `event.documentStatus`가 정한 넷('전체'는 거르개의 말이다). */
export const documentStatus = pgEnum('document_status', [
  'notStarted',
  'drafting',
  'reviewing',
  'confirmed',
])

/**
 * 문서.
 *
 * **행사 문서·회의 자료·업무 문서가 한 표다.** 명세가 그렇게 말한다: 회의 쪽은
 * '안건의 사전 자료와 회의록의 관련 자료가 같은 물건'이라 적었고, 업무 쪽은 참고
 * 문서가 '업무의 것이 아니라 행사의 공용 원본이라 여러 업무가 같은 것을 본다'고
 * 적었다 — 갈라 두면 같은 문서가 두 표에 두 벌 생긴다.
 *
 * **파일은 아직 담지 않는다.** 명세의 어느 조각도 파일이 어디 있는지를 묻지 않는다
 * (이름과 상태뿐이다) — 저장할 곳을 정하는 것은 배포의 일이고 그 자리가 아직 없다.
 */
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 무엇에 딸린 문서인가. 셋 다 비어 있을 수 있다(학생회의 공용 문서). */
    eventId: text('event_id'),
    meetingId: text('meeting_id'),
    /** 안건의 사전 자료면 그 안건을 가리킨다(`meeting.documents`의 agendaId). */
    agendaId: text('agenda_id'),
    /** 업무가 내놓은 작업 문서면 그 업무를 가리킨다(`task.workDocuments`). */
    taskId: text('task_id'),
    /** 무슨 갈래의 문서인가(EVT-DOC-01의 표 첫 열). 조직이 부르는 말이다. */
    category: text('category'),
    title: text('title').notNull(),
    description: text('description'),
    status: documentStatus('status').notNull().default('notStarted'),
    updatedByMemberId: text('updated_by_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('documents_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'documents_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.meetingId],
      foreignColumns: [meetings.orgId, meetings.id],
      name: 'documents_meeting_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.agendaId],
      foreignColumns: [meetingAgendas.orgId, meetingAgendas.id],
      name: 'documents_agenda_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.taskId],
      foreignColumns: [tasks.orgId, tasks.id],
      name: 'documents_task_same_org',
    }).onDelete('cascade'),
    index('documents_event_status').on(table.eventId, table.status),
    index('documents_meeting').on(table.meetingId),
    index('documents_task').on(table.taskId),
  ],
)

// ─── 재정 ────────────────────────────────────────────────────────────────────

/**
 * 구매 요청이 지금 어느 단계인가.
 *
 * **행사 재정 보드의 네 열이 이 값이다** — EVT-FIN-01이 열마다 `review`·`purchase`·
 * `proof`·`settled`를 인자로 박아 조회한다. 아직 안 낸 요청(`draft`)은 보드에
 * 오지 않지만 어딘가에는 있어야 하므로 여기 함께 둔다.
 *
 * **보완은 단계가 아니다.** 보완이 걸린 요청도 검토 중이고, 걸렸다는 사실은
 * `supplementRequestedAt`이 말한다 — 단계로 두면 보드에 다섯째 열이 생긴다.
 */
export const purchaseStage = pgEnum('purchase_stage', [
  'draft',
  'review',
  'purchase',
  'proof',
  'settled',
  /**
   * 반려되어 끝난 요청.
   *
   * **사람이 정했다(2026-09-06): 반려되면 요청이 거기서 끝난다.** 다시 사려면 새로
   * 쓴다. 한동안 이 값이 없어서 전부 반려된 요청이 승인액 0원으로 구매 단계에 섰다 —
   * 계약이 반려의 뒤를 말하지 않아 '보완 없음 = 검토 끝'으로 읽었기 때문이다.
   *
   * **보드의 열이 아니다.** EVT-FIN-01은 네 단계를 인자로 박아 조회하므로 반려된
   * 요청은 어느 열에도 오지 않는다 — 끝난 것이 진행 중인 것 사이에 남아 있으면
   * 사람이 그것을 아직 살 것으로 읽는다.
   */
  'rejected',
])

/**
 * 재정부가 품목마다 내리는 판정. `finance.reviewResults`가 정한 셋.
 *
 * **판정의 단위가 품목이다** — 명세가 그렇게 적었고(FIN-REV-01), 그래서 요청이
 * 아니라 품목이 이 값을 갖는다. 하나라도 보완이면 나가는 것이 보완 요청이고
 * 전부 승인이면 검토가 끝난다.
 */
export const reviewResult = pgEnum('review_result', ['approved', 'supplement', 'rejected'])

/** 견적을 받았는가. `finance.quoteStatus`가 정한 셋. */
export const quoteStatus = pgEnum('quote_status', ['none', 'requested', 'received'])

/**
 * 예산 항목.
 *
 * **행사의 예산과 조직의 예산이 한 표다.** 명세가 둘을 갈라 두었지만(`finance.budgetItems`는
 * eventId를 받고 `finance.orgBudgetItems`는 안 받는다) 다른 것은 **무엇에 딸렸느냐**뿐이다 —
 * 행사에 속하지 않는 상시 지출도 항목을 갖는다고 명세가 적었다.
 *
 * **예산 편성 화면(FIN-PLAN-01)이 채운다**(2026-09-05에 그렸다). 한동안 그 화면이
 * 명세에 없어 이 표가 비어 있었다. 이제 기간·수입원·항목이 한 벌로 저장된다 —
 * `budget_periods`·`budget_sources`가 그 벌의 나머지다.
 */
export const budgetItems = pgTable(
  'budget_items',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 어느 행사의 예산인가. 비어 있으면 학생회의 상시 항목이다. */
    eventId: text('event_id'),
    name: text('name').notNull(),
    /** 배정된 금액(원). 화폐 표기는 읽을 때 붙인다 — 자릿점은 값이 아니라 글이다. */
    amount: integer('amount').notNull().default(0),
    /**
     * 담당 부서(선택). **부서별 집행률이 이것으로 선다**(FIN-00의 '부서별' 축).
     * 사람이 정했다(2026-09-05): 상시 항목에 한 칸. 행사 항목은 행사가 곧 축이라 비운다.
     */
    departmentId: text('department_id'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    unique('budget_items_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'budget_items_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'budget_items_department_same_org',
    }).onDelete('set null'),
    index('budget_items_org_event').on(table.orgId, table.eventId),
  ],
)

/**
 * 회계 기간(FIN-PLAN-01의 첫 덩이). **학생회에 하나다** — 시작일과 끝일로 받는다.
 * 학기든 연도든 단위를 못 박지 않는다(사람이 정함, 2026-09-05). `finance.orgOverview`의
 * '회계 기간·기준일' 첫 줄이 여기서 나온다. 없으면 아직 편성 전이다.
 */
export const budgetPeriods = pgTable(
  'budget_periods',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('budget_periods_once').on(table.orgId)],
)

/**
 * 수입원(FIN-PLAN-01의 둘째 덩이). **총예산은 이것의 합이다** — `finance.orgOverview`의
 * `totalBudget`과 '학생회비 외 1건'(`totalBudgetNote`)이 여기서 나온다. 배정의 합은 이
 * 합을 넘지 못한다(저장할 때 서버가 막는다).
 */
export const budgetSources = pgTable(
  'budget_sources',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 금액(원). 자릿점은 읽을 때 붙인다. */
    amount: integer('amount').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [unique('budget_sources_org_id').on(table.orgId, table.id), index('budget_sources_org').on(table.orgId)],
)

/**
 * 구매 요청 한 건.
 *
 * 요청하고 → 검토받고 → 사고 → 증빙을 붙이는 한 흐름이 이 한 줄을 따라간다
 * (FIN-REQ-01 · FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01). 화면마다 표를 두면 같은
 * 요청이 넷으로 갈라지고, '지금 어디까지 왔나'를 아무도 한 줄로 못 말한다.
 */
export const purchaseRequests = pgTable(
  'purchase_requests',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 어느 행사의 지출인가. 비어 있으면 학생회의 상시 지출이다. */
    eventId: text('event_id'),
    /** 사람이 부르는 번호('PR-2026-0031'). 서버가 만든다. */
    code: text('code'),
    title: text('title').notNull(),
    /** 왜 사는가. FIN-REQ-01의 칸이고 FIN-REV-01이 그대로 읽는다. */
    purpose: text('purpose'),
    departmentId: text('department_id'),
    requesterMemberId: text('requester_member_id'),
    /** 얼마나 급한가. 값의 목록이 아직 없다(`finance.requestPriorities`). */
    priority: text('priority'),
    /** 언제까지 필요한가. */
    neededOn: timestamp('needed_on', { withTimezone: true }),
    stage: purchaseStage('stage').notNull().default('draft'),
    /** 재정부로 넘긴 때. 임시 저장만 한 요청에는 없다. */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedByMemberId: text('reviewed_by_member_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /**
     * 보완이 걸린 때와 언제까지 다시 내야 하는가(FIN-SUP-01의 머리).
     *
     * 요청 하나에 보완은 한 번 걸린다 — 품목마다 걸리는 것은 사유이고, 언제까지
     * 다시 내라는 것은 요청 전체의 기한이다.
     */
    supplementRequestedAt: timestamp('supplement_requested_at', { withTimezone: true }),
    supplementDueOn: timestamp('supplement_due_on', { withTimezone: true }),
    /** 결제·증빙 정리를 끝낸 때(`finance.purchaseRequest.completeEvidence`). */
    evidenceCompletedAt: timestamp('evidence_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('purchase_requests_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'purchase_requests_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'purchase_requests_department_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.requesterMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'purchase_requests_requester_same_org',
    }).onDelete('set null'),
    index('purchase_requests_org_stage').on(table.orgId, table.stage),
    index('purchase_requests_event_stage').on(table.eventId, table.stage),
  ],
)

/**
 * 발주. **묶음 하나가 업체 하나다** — 명세가 그렇게 적었다(FIN-PROC-01).
 *
 * 품목을 어느 업체에서 사느냐로 주문이 갈리고, 주문일도 담당도 업체마다 따로 간다.
 */
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    requestId: text('request_id').notNull(),
    vendor: text('vendor').notNull(),
    orderedOn: timestamp('ordered_on', { withTimezone: true }),
    ordererMemberId: text('orderer_member_id'),
  },
  (table) => [
    unique('purchase_orders_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.requestId],
      foreignColumns: [purchaseRequests.orgId, purchaseRequests.id],
      name: 'purchase_orders_request_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.ordererMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'purchase_orders_orderer_same_org',
    }).onDelete('set null'),
    index('purchase_orders_request').on(table.requestId),
  ],
)

/**
 * 결제. **묶음 하나가 결제 하나다** — 명세가 그렇게 적었다(FIN-EVID-01).
 *
 * **승인액과 실결제액이 다를 수 있고, 그 차이가 이 단계에서 드러나는 것이 이 화면의
 * 일이다.** 승인액은 품목이 갖고(`purchaseRequestItems.approvedAmount`) 실제로 낸
 * 돈은 여기 있다 — 한 자리에 담으면 차이를 볼 수 없다.
 */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    requestId: text('request_id').notNull(),
    vendor: text('vendor').notNull(),
    paidOn: timestamp('paid_on', { withTimezone: true }),
    payerMemberId: text('payer_member_id'),
    /** 무엇으로 냈는가(법인카드·계좌이체 같은 것). 값의 목록이 명세에 없다. */
    method: text('method'),
    /** 실제로 낸 돈(원). */
    paidAmount: integer('paid_amount').notNull().default(0),
  },
  (table) => [
    unique('payments_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.requestId],
      foreignColumns: [purchaseRequests.orgId, purchaseRequests.id],
      name: 'payments_request_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.payerMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'payments_payer_same_org',
    }).onDelete('set null'),
    index('payments_request').on(table.requestId),
  ],
)

/**
 * 결제에 붙는 증빙 서류(영수증·거래명세서 같은 것).
 *
 * **행사 문서(`documents`)와 다른 물건이다.** 저것은 사람이 쓰는 문서라 작성 단계를
 * 갖고, 이것은 받아서 붙이는 종이라 **붙었는가 안 붙었는가**뿐이다 — 화면이 그린
 * 딱지도 '등록 완료'와 '누락' 둘이다.
 *
 * 붙어야 하는 서류가 무엇인지는 조직의 재정 규칙이고 그것을 정하는 화면이 아직
 * 없다. 그래서 필요한 줄을 서버가 만들어 두고, 붙으면 `registeredAt`이 찍힌다.
 */
export const paymentDocuments = pgTable(
  'payment_documents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    paymentId: text('payment_id').notNull(),
    label: text('label').notNull(),
    /** 붙은 때. 비어 있으면 '누락'이다. */
    registeredAt: timestamp('registered_at', { withTimezone: true }),
  },
  (table) => [
    unique('payment_documents_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.paymentId],
      foreignColumns: [payments.orgId, payments.id],
      name: 'payment_documents_payment_same_org',
    }).onDelete('cascade'),
    index('payment_documents_payment').on(table.paymentId),
  ],
)

/**
 * 요청에 담긴 품목.
 *
 * **한 줄이 요청의 처음부터 끝까지 따라간다** — 적을 때의 값(이름·수량·단가), 검토가
 * 내린 판정과 승인액, 어느 발주에 실렸고 언제 오는지, 어느 결제에 딸렸는지가 전부
 * 이 한 줄에 쌓인다. 단계마다 표를 두면 같은 품목이 넷으로 갈라지고, 그때부터
 * '승인 25,000원 → 실결제 24,500원' 같은 견줌을 아무도 할 수 없다.
 *
 * **주문 상태와 배송 상태를 값으로 두지 않는다.** 화면이 그리는 '주문 완료'는 발주에
 * 실렸다는 뜻이고 '배송 중'은 올 날이 잡혔는데 아직 안 왔다는 뜻이다 — 둘 다 여기
 * 있는 사실에서 나오는 말이라, 값으로 또 두면 사실과 말이 갈릴 자리가 생긴다.
 */
export const purchaseRequestItems = pgTable(
  'purchase_request_items',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    requestId: text('request_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    name: text('name').notNull(),
    /** 품목 카테고리·구매 유형. 명세가 '조직이 정한다'고 했으나 정하는 화면이 없다. */
    category: text('category'),
    purchaseType: text('purchase_type'),
    budgetItemId: text('budget_item_id'),
    quantity: integer('quantity'),
    unit: text('unit'),
    unitPrice: integer('unit_price'),
    vendor: text('vendor'),
    productUrl: text('product_url'),
    /** 색상·사이즈 같은 것. 무엇을 묻는지는 구매 유형이 정한다. */
    option: text('option'),
    deliveryNote: text('delivery_note'),
    quoteStatus: quoteStatus('quote_status').notNull().default('none'),
    /** 재정부의 판정과 승인액. 검토 전에는 비어 있다. */
    reviewResult: reviewResult('review_result'),
    approvedAmount: integer('approved_amount'),
    /** 보완이면 그 사유. FIN-SUP-01이 품목마다 그린다. */
    reviewNote: text('review_note'),
    /**
     * 보완 답변.
     *
     * **칸의 이름을 열로 둘 수 없다.** 무엇을 다시 묻는지는 그 품목의 구매 유형이
     * 정하고, 명세가 '칸 목록을 명세가 들고 있으면 유형이 하나 늘 때마다 명세가
     * 틀린다'고 적었다 — 열로 두면 표가 같은 이유로 틀린다.
     */
    supplementAnswers: jsonb('supplement_answers'),
    /** 어느 발주에 실렸는가. 실리면 화면이 '주문 완료'로 그린다. */
    orderId: text('order_id'),
    expectedDeliveryOn: timestamp('expected_delivery_on', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** 어느 결제에 딸렸는가(FIN-EVID-01이 결제마다 품목을 묶어 그린다). */
    paymentId: text('payment_id'),
  },
  (table) => [
    unique('purchase_request_items_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.requestId],
      foreignColumns: [purchaseRequests.orgId, purchaseRequests.id],
      name: 'purchase_request_items_request_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.budgetItemId],
      foreignColumns: [budgetItems.orgId, budgetItems.id],
      name: 'purchase_request_items_budget_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.orderId],
      foreignColumns: [purchaseOrders.orgId, purchaseOrders.id],
      name: 'purchase_request_items_order_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.paymentId],
      foreignColumns: [payments.orgId, payments.id],
      name: 'purchase_request_items_payment_same_org',
    }).onDelete('set null'),
    index('purchase_request_items_request').on(table.requestId, table.sortOrder),
  ],
)

/**
 * 장부 한 줄.
 *
 * **`finance.ledger`와 `finance.recentExpenses`가 같은 장부다** — 명세가 그렇게
 * 적었다. 한쪽은 전부를 걸러 볼 수 있게 주는 자리이고 다른 쪽은 겉면에 몇 줄만
 * 얹는 자리다.
 *
 * **결제와 다른 표다.** 결제는 구매 요청에 딸린 것이고 장부는 학생회가 쓴 돈 전부다 —
 * 요청을 거치지 않은 상시 지출도 장부에는 있어야 한다고 명세가 적었다
 * (`finance.orgBudgetItems`가 '행사에 속하지 않는 상시 지출까지 덮는다'고 말한다).
 * 요청에서 온 줄은 그 요청을 가리킨다.
 *
 * **장부에 줄을 넣는 쓰기가 명세에 없다.** 예산과 같은 사정이다 — 표는 자리를
 * 비워 두고 기다린다.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: text('event_id'),
    departmentId: text('department_id'),
    budgetItemId: text('budget_item_id'),
    /** 이 줄이 어느 구매 요청에서 왔는가. 상시 지출에는 없다. */
    purchaseRequestId: text('purchase_request_id'),
    spentOn: timestamp('spent_on', { withTimezone: true }).notNull(),
    title: text('title').notNull(),
    /** 무엇 때문에 쓴 돈인가(행사 이름 같은 것). 화면이 제목 아래 곁들인다. */
    context: text('context'),
    amount: integer('amount').notNull().default(0),
    /** 증빙이 다 붙었는가. 화면의 딱지가 이것을 그린다. */
    proofDone: boolean('proof_done').notNull().default(false),
  },
  (table) => [
    unique('ledger_entries_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'ledger_entries_event_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.departmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'ledger_entries_department_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.budgetItemId],
      foreignColumns: [budgetItems.orgId, budgetItems.id],
      name: 'ledger_entries_budget_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.purchaseRequestId],
      foreignColumns: [purchaseRequests.orgId, purchaseRequests.id],
      name: 'ledger_entries_request_same_org',
    }).onDelete('set null'),
    index('ledger_entries_org_spent').on(table.orgId, table.spentOn),
    index('ledger_entries_event').on(table.eventId),
  ],
)

// ─── 행사 운영 조직 ──────────────────────────────────────────────────────────

/**
 * 행사에만 있는 부서.
 *
 * **학생회의 부서(`departments`)와 다른 물건이다** — 명세가 그렇게 못 박았다
 * (`event.staffLeaders`가 'org.executives와 같은 모양이지만 다른 물건'이라고 적었다).
 * 학생회의 기본 조직은 한 대를 가고, 이것은 행사 하나에만 있다가 사라진다.
 */
export const eventStaffDepartments = pgTable(
  'event_staff_departments',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    eventId: text('event_id').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    unique('event_staff_departments_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'event_staff_departments_event_same_org',
    }).onDelete('cascade'),
    index('event_staff_departments_event').on(table.eventId, table.sortOrder),
  ],
)

/**
 * 행사 운영 조직에 든 사람.
 *
 * **책임자·부서장·부원·미배정이 한 표다.** 넷을 갈라 두면 사람을 옮길 때마다 표
 * 사이를 오가게 되고, 그때 두 표에 동시에 있거나 어디에도 없는 순간이 생긴다 —
 * 학생회의 `members`가 부서를 열 하나로 들고 있는 것과 같은 까닭이다.
 *
 * - 행사 책임자: `isEventLeader`
 * - 부서장: 부서를 가리키고 `isDepartmentLeader`
 * - 부원: 부서를 가리킨다
 * - 미배정: 부서가 비어 있고 책임자도 아니다(`event.staffUnassignedMembers`)
 *
 * 이름·학과·학년은 여기 없다 — 그것은 학생회 구성원의 사실이라 `members`가 든다.
 */
export const eventStaffMembers = pgTable(
  'event_staff_members',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    eventId: text('event_id').notNull(),
    memberId: text('member_id').notNull(),
    /** 어느 부서인가. 비어 있으면 아직 배정되지 않았거나 행사 책임자다. */
    staffDepartmentId: text('staff_department_id'),
    isEventLeader: boolean('is_event_leader').notNull().default(false),
    isDepartmentLeader: boolean('is_department_leader').notNull().default(false),
    /** 이 행사에서 부르는 직함. 없으면 화면이 딱지를 안 그린다. */
    roleTitle: text('role_title'),
  },
  (table) => [
    unique('event_staff_members_org_id').on(table.orgId, table.id),
    // 한 사람이 한 행사의 운영 조직에 두 번 들어가지 않는다.
    unique('event_staff_members_once').on(table.eventId, table.memberId),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'event_staff_members_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.memberId],
      foreignColumns: [members.orgId, members.id],
      name: 'event_staff_members_member_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.staffDepartmentId],
      foreignColumns: [eventStaffDepartments.orgId, eventStaffDepartments.id],
      name: 'event_staff_members_department_same_org',
    }).onDelete('set null'),
    index('event_staff_members_department').on(table.staffDepartmentId),
  ],
)

// ─── 참여 설문의 문항 ────────────────────────────────────────────────────────

/** 문항의 갈래. `event.surveyQuestionTypes`가 정한 넷. */
export const surveyQuestionType = pgEnum('survey_question_type', [
  'short',
  'choice',
  'checkbox',
  'privacy',
])

/**
 * 참여 설문의 문항(EVT-05).
 *
 * **고를 값의 목록은 아직 없다.** 명세의 어느 조각도 보기(선택지)를 묻지 않는다 —
 * EVT-05가 그리는 것은 제목·갈래·딱지뿐이고, 보기를 적는 자리가 그려지지 않았다.
 * 없는 화면을 전제한 열은 지어낸 것이라 두지 않는다.
 */
export const surveyQuestions = pgTable(
  'survey_questions',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    surveyId: text('survey_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    title: text('title').notNull(),
    type: surveyQuestionType('type').notNull(),
    required: boolean('required').notNull().default(false),
    /**
     * 지울 수 없는 문항인가(EVT-05의 잠금 표시).
     *
     * 개인정보 동의처럼 빼면 안 되는 것이 있다 — 무엇이 그런지는 제품이 정하고,
     * 표는 그 판정을 담는다.
     */
    locked: boolean('locked').notNull().default(false),
  },
  (table) => [
    unique('survey_questions_org_id').on(table.orgId, table.id),
    foreignKey({
      columns: [table.orgId, table.surveyId],
      foreignColumns: [surveys.orgId, surveys.id],
      name: 'survey_questions_survey_same_org',
    }).onDelete('cascade'),
    index('survey_questions_survey').on(table.surveyId, table.sortOrder),
  ],
)

// ─── 행사 아카이브 ───────────────────────────────────────────────────────────

/**
 * 아카이브가 어디까지 왔는가.
 *
 * **검토를 통과하면 발행이다**(2026-09-05에 사람이 정했다). 한동안 `published`가
 * 있는데 거기로 가는 길이 없었다 — `record.archive.requestReview`가 '발행이 아니다'라고
 * 못 박고, 발행 단추는 어느 화면에도 없었다. 이제 검토자가 승인하는 순간이 발행이다.
 * 그 승인을 누르는 자리는 그림에 아직 없어 그리는 중이다 — 표는 먼저 그 순간을
 * 담을 자리를 갖는다(`publishedAt`·`frozen`).
 */
export const archiveStatus = pgEnum('archive_status', ['draft', 'inReview', 'published'])

/**
 * 행사 아카이브(REC-02A).
 *
 * **행사 하나에 하나다.** 인수인계 문서라 다음 대가 읽는 것이고, 여러 벌이 있으면
 * 어느 것이 그 행사의 기록인지가 갈린다.
 *
 * 여기 있는 것은 **사람이 직접 쓰는 칸**과 **발행 시점에 굳은 값**이다.
 *
 * 개요·성과·타임라인·근거는 행사 데이터에서 서버가 줄여 만든다. 발행 전에는 읽을
 * 때마다 지금 값으로 만들고, **발행하는 순간 그때 값으로 굳는다**(`frozen`) — 명세가
 * 그렇게 적었고('위 수치는 발행 시점 기준입니다. 원본이 이후 변경되어도 이 문서는
 * 바뀌지 않습니다'), 원본은 계속 바뀌므로 그 값은 나중에 다시 셈할 수 없는 **사실**이다.
 *
 * 열세 개 열이 아니라 jsonb 하나인 까닭: 한 번 쓰고 통째로만 읽는 값이고, 모양이
 * 곧 계약의 응답 모양이다. 갈라 두면 열이 서른 개 넘게 늘고 어느 하나도 따로 읽히지
 * 않는다(구매요청의 `supplementAnswers`와 같은 사정).
 */
export const eventArchives = pgTable(
  'event_archives',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    /** 행사 하나에 하나. 아래 unique가 그것을 지킨다. */
    eventId: text('event_id').notNull(),
    status: archiveStatus('status').notNull().default('draft'),
    /** 문서의 이름. 비어 있으면 서버가 행사 이름으로 만든 글을 준다. */
    title: text('title'),
    /** 사람이 쓰는 칸 여섯(REC-02A). 아직 아무것도 안 쓴 문서도 이 표에 있다. */
    onSiteOperation: text('on_site_operation'),
    retroGood: text('retro_good'),
    retroIssues: text('retro_issues'),
    retroImprovements: text('retro_improvements'),
    handover: text('handover'),
    /** 다음 담당자. 학생회 구성원이 아닐 수 있어 글로 받는다(REC-02A의 칸이 입력이다). */
    nextOwner: text('next_owner'),
    /** 개선안을 맡을 부서. REC-02A가 `org.departments`에서 고르게 한다. */
    improvementDepartmentId: text('improvement_department_id'),
    /** 쓴 사람과 검토자. 검토자는 `record.archiveReviewers`에서 고른다. */
    authorMemberId: text('author_member_id'),
    reviewerMemberId: text('reviewer_member_id'),
    /**
     * 검토 의견.
     *
     * **쓰는 사람이 아니라 검토자가 적는 값이라 초안과 갈린다** — 명세가 그렇게
     * 적었고(`record.archiveReview`), 그래서 한 칸이 아니라 다른 사람의 칸이다.
     */
    reviewComment: text('review_comment'),
    /** 검토로 넘긴 때. `record.archive.requestReview`가 찍는다. */
    reviewRequestedAt: timestamp('review_requested_at', { withTimezone: true }),
    /** 인수인계 초안을 기계가 만들어 준 때. 사람이 쓴 것과 갈라야 안내를 붙일 수 있다. */
    handoverDraftedAt: timestamp('handover_drafted_at', { withTimezone: true }),
    /**
     * 발행된 때와 발행한 사람. **검토를 통과한 순간이다** — 검토자가 승인하면 찍힌다.
     * 비어 있으면 아직 발행 전이고, 그때 REC-02는 지금 값으로 그린다.
     */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedByMemberId: text('published_by_member_id'),
    /**
     * 발행 시점에 굳은 값. 개요·성과·현장 운영의 열세 조각, 타임라인, 근거 자료,
     * 자동 채움 네 줄 — `record.archiveDetail`·`archiveTimeline`·`archiveEvidence`·
     * `archiveAutoFilled`의 응답 모양 그대로다. 발행 전에는 비어 있다.
     */
    frozen: jsonb('frozen'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('event_archives_org_id').on(table.orgId, table.id),
    unique('event_archives_once').on(table.eventId),
    foreignKey({
      columns: [table.orgId, table.eventId],
      foreignColumns: [events.orgId, events.id],
      name: 'event_archives_event_same_org',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.orgId, table.improvementDepartmentId],
      foreignColumns: [departments.orgId, departments.id],
      name: 'event_archives_department_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.authorMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'event_archives_author_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.reviewerMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'event_archives_reviewer_same_org',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.orgId, table.publishedByMemberId],
      foreignColumns: [members.orgId, members.id],
      name: 'event_archives_publisher_same_org',
    }).onDelete('set null'),
    index('event_archives_org_status').on(table.orgId, table.status),
  ],
)
