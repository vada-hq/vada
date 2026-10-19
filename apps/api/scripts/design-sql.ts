// 첫 마이그레이션(0000_baseline.sql)의 재료. 설계 SQL 블록을 뽑고 문장으로 나누는 순수 함수와, 설계 밖 표의 SQL을 둔다.
// 설계 SQL은 손으로 옮기지 않는다(다시 만들기 설계서). baseline-from-design.ts와 check-design.ts가 같이 쓴다.

// drizzle 마이그레이터는 이 표시로 파일을 잘라 한 조각씩 실행한다. 조각마다 문장 하나를 둔다.
export const BREAKPOINT = '--> statement-breakpoint'

// 설계 검사에서 뺄 표: 로그인 표 4개와 설계 밖 표 3개(바탕 spec G11)
export const AUTH_TABLES = ['users', 'accounts', 'sessions', 'verifications'] as const
export const OUTSIDE_TABLES = ['member_login', 'invite_code', 'push_device'] as const
export const NOT_IN_DESIGN: ReadonlySet<string> = new Set([...AUTH_TABLES, ...OUTSIDE_TABLES])

// 로그인 표 4개. 옛 0000_rare_cardiac.sql과 0001_auth.sql의 정의 그대로다(better-auth가 쓴다).
export const AUTH_STATEMENTS = [
  `CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);`,
  `CREATE TABLE "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_provider_account_unique" UNIQUE("provider_id","account_id")
);`,
  `CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE("token")
);`,
  `CREATE TABLE "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);`,
  'ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;',
  'ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;',
  'CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");',
  'CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");',
  'CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");',
]

// 설계 밖 표 3개. 바탕 spec(docs/superpowers/specs/2026-10-19-foundation-design.md)의 '첫 마이그레이션' 그대로다.
export const OUTSIDE_STATEMENTS = [
  `-- 로그인 잇기: 로그인 계정(users)과 운영진(member)을 하나씩 잇는다(G1)
CREATE TABLE member_login (
  member_id uuid PRIMARY KEY REFERENCES member (id),
  user_id   text NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);`,
  `-- 초대 코드: 학생회마다 하나(G2). 형식은 지금 vada와 같다
CREATE TABLE invite_code (
  council_id uuid PRIMARY KEY REFERENCES council (id),
  code       text NOT NULL UNIQUE CHECK (code ~ '^[2-9A-HJ-NP-Z]{8}$'),
  created_by uuid NOT NULL REFERENCES member (id),
  created_at timestamptz NOT NULL DEFAULT now()
);`,
  'CREATE INDEX ON invite_code (created_by);',
  `-- 알림 받을 기기(G10). 구독 주소는 기기를 가리키는 비밀 주소다
CREATE TABLE push_device (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1024),
  p256dh          text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth            text NOT NULL CHECK (char_length(auth) <= 100),
  expiration_time timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);`,
  'CREATE INDEX ON push_device (user_id);',
]

// physical-model.md의 첫 SQL 블록(```sql … ```)을 꺼낸다.
export function designBlock(markdown: string): string {
  const text = markdown.replace(/\r\n/g, '\n')
  const start = text.indexOf('```sql\n')
  if (start < 0) throw new Error('physical-model.md에 SQL 블록이 없다')
  const end = text.indexOf('\n```', start + '```sql\n'.length)
  if (end < 0) throw new Error('SQL 블록이 닫히지 않았다')
  return text.slice(start + '```sql\n'.length, end)
}

const comment = /^\s*--/
// 문장은 줄 끝의 ;에서 끝난다(뒤에 -- 주석이 붙어도 된다). 주석 줄의 ;은 문장의 끝이 아니다.
const statementEnd = /;\s*(--.*)?$/

// 블록을 문장으로 나눈다. 문장 앞의 주석 줄은 그 문장에 붙는다. 함수 본문($$)은 설계에 없어 다루지 않는다.
export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current: string[] = []
  for (const line of sql.replace(/\r\n/g, '\n').split('\n')) {
    current.push(line)
    if (!comment.test(line) && statementEnd.test(line)) {
      statements.push(current.join('\n').trim())
      current = []
    }
  }
  if (current.some(line => line.trim() && !comment.test(line)))
    throw new Error('마지막 문장이 ;로 끝나지 않는다')
  return statements
}

// 문장 사이에만 표시를 넣는다. 마지막 문장 뒤에는 넣지 않는다(빈 조각을 실행하지 않게).
export const joinStatements = (statements: readonly string[]) =>
  statements.join(`\n${BREAKPOINT}\n`)

// 0000_baseline.sql의 내용: 로그인 표 4개 → 설계 SQL 블록 → 설계 밖 표 3개. 줄바꿈은 LF다.
export function baselineOf(designMarkdown: string): string {
  const header = [
    '-- 0000_baseline: 첫 마이그레이션. apps/api/scripts/baseline-from-design.ts가 만든다. 손으로 고치지 않는다.',
    '-- 로그인 표 4개(지금 정의 그대로) → vada-docs physical-model.md의 SQL 블록 → 설계 밖 표 3개(바탕 spec).',
  ].join('\n')
  const statements = [
    ...AUTH_STATEMENTS,
    ...splitStatements(designBlock(designMarkdown)),
    ...OUTSIDE_STATEMENTS,
  ]
  return `${header}\n${joinStatements(statements)}\n`
}
