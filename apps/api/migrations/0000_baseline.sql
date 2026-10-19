-- 0000_baseline: 첫 마이그레이션. apps/api/scripts/baseline-from-design.ts가 만든다. 손으로 고치지 않는다.
-- 로그인 표 4개(지금 정의 그대로) → vada-docs physical-model.md의 SQL 블록 → 설계 밖 표 3개(바탕 spec).
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
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
);
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- 공통 ------------------------------------------------------------------

CREATE TABLE record (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  kind         text NOT NULL CHECK (kind IN (
                 'council', 'cohort', 'member', 'council_membership', 'department',
                 'department_membership', 'audit_body', 'voting_body', 'fiscal_period',
                 'budget', 'budget_item', 'income', 'expense', 'payment_line', 'evidence',
                 'account_closing', 'fee_payment', 'deposit', 'account', 'event', 'task', 'request',
                 'line_item', 'registration_form', 'registration', 'attendance', 'meeting', 'agenda_item', 'poll',
                 'poll_option', 'poll_response', 'approval', 'decision', 'document',
                 'draft_item', 'source', 'chat_room', 'message', 'file', 'notification')),
  council_id   uuid,  -- 학생회를 넘어 이어지는 운영진과 학생회 자신은 비운다
  created_by   uuid,  -- 신청자가 만든 기록과 시스템이 만든 기록(알림)은 비운다
  created_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  UNIQUE (id, kind),
  UNIQUE (id, council_id),
  CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL))
);
--> statement-breakpoint
CREATE TABLE record_version (
  record_id   uuid NOT NULL REFERENCES record (id),
  version_no  integer NOT NULL CHECK (version_no > 0),
  valid       tstzrange NOT NULL,
  data        jsonb NOT NULL,  -- 그 판의 칸 값 전체
  changed_by  uuid,            -- 그 판을 만든 사람. 신청자나 시스템이면 비운다(DEC-44, DEC-46)
  reason      text,            -- 확정한 기록을 바꿀 때 받는다(DEC-34)
  PRIMARY KEY (record_id, version_no),
  EXCLUDE USING gist (record_id WITH =, valid WITH &&)
);
--> statement-breakpoint
-- 조직 ------------------------------------------------------------------

CREATE TABLE council (
  id                   uuid PRIMARY KEY,
  kind                 text NOT NULL DEFAULT 'council' CHECK (kind = 'council'),
  name                 text NOT NULL CHECK (char_length(name) <= 50),
  unit                 text NOT NULL CHECK (unit IN ('department', 'college', 'university')),
  school_name          text NOT NULL CHECK (char_length(school_name) <= 50),
  president_title      text NOT NULL DEFAULT '회장' CHECK (char_length(president_title) <= 20),
  vice_president_title text NOT NULL DEFAULT '부회장' CHECK (char_length(vice_president_title) <= 20),
  head_title           text NOT NULL DEFAULT '부장' CHECK (char_length(head_title) <= 20),
  vice_head_title      text NOT NULL DEFAULT '부부장' CHECK (char_length(vice_head_title) <= 20),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE member (
  id    uuid PRIMARY KEY,
  kind  text NOT NULL DEFAULT 'member' CHECK (kind = 'member'),
  name  text NOT NULL,
  email text NOT NULL UNIQUE,  -- 가정: 로그인 수단
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
ALTER TABLE record
  ADD FOREIGN KEY (council_id) REFERENCES council (id) DEFERRABLE INITIALLY DEFERRED,
  ADD FOREIGN KEY (created_by) REFERENCES member (id) DEFERRABLE INITIALLY DEFERRED,
  ADD FOREIGN KEY (confirmed_by) REFERENCES member (id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE record_version
  ADD FOREIGN KEY (changed_by) REFERENCES member (id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE TABLE cohort (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'cohort' CHECK (kind = 'cohort'),
  council_id uuid NOT NULL,
  name       text NOT NULL CHECK (char_length(name) <= 20),
  starts_on  date NOT NULL,
  ends_on    date NOT NULL CHECK (ends_on > starts_on),
  UNIQUE (council_id, name),
  EXCLUDE USING gist (council_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&),  -- 기수의 기간은 겹치지 않는다
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE TABLE council_membership (
  id           uuid PRIMARY KEY,
  kind         text NOT NULL DEFAULT 'council_membership' CHECK (kind = 'council_membership'),
  member_id    uuid NOT NULL REFERENCES member (id),
  cohort_id    uuid NOT NULL REFERENCES cohort (id),
  council_rank text CHECK (council_rank IN ('president', 'vice_president')),  -- 비면 직급 없음
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz CHECK (ends_at > starts_at),  -- 내보낼 때 적는다
  UNIQUE (member_id, cohort_id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
-- 회장은 기수마다 한 명이다(DEC-17). 기수는 한 학생회에만 속하므로 학생회마다 한 명과 같다.
CREATE UNIQUE INDEX ON council_membership (cohort_id) WHERE council_rank = 'president' AND ends_at IS NULL;
--> statement-breakpoint
CREATE TABLE department (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'department' CHECK (kind = 'department'),
  council_id uuid NOT NULL,
  name       text NOT NULL CHECK (char_length(name) <= 20),
  role       text CHECK (role IN ('finance')),  -- 비면 역할 없음
  UNIQUE (council_id, name),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE TABLE department_membership (
  id              uuid PRIMARY KEY,
  kind            text NOT NULL DEFAULT 'department_membership' CHECK (kind = 'department_membership'),
  member_id       uuid NOT NULL REFERENCES member (id),
  department_id   uuid NOT NULL REFERENCES department (id),
  cohort_id       uuid NOT NULL REFERENCES cohort (id),
  department_rank text CHECK (department_rank IN ('head', 'vice_head')),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz CHECK (ends_at > starts_at),
  UNIQUE (member_id, department_id, cohort_id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE audit_body (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'audit_body' CHECK (kind = 'audit_body'),
  council_id uuid NOT NULL UNIQUE,
  name       text NOT NULL,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE TABLE voting_body (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'voting_body' CHECK (kind = 'voting_body'),
  council_id uuid NOT NULL UNIQUE,
  name       text NOT NULL,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
-- 돈 --------------------------------------------------------------------

CREATE TABLE fiscal_period (
  id                 uuid PRIMARY KEY,
  kind               text NOT NULL DEFAULT 'fiscal_period' CHECK (kind = 'fiscal_period'),
  council_id         uuid NOT NULL,
  name               text NOT NULL,
  starts_on          date NOT NULL,
  ends_on            date NOT NULL CHECK (ends_on > starts_on),
  previous_period_id uuid UNIQUE REFERENCES fiscal_period (id),  -- 이월
  UNIQUE (council_id, name),
  EXCLUDE USING gist (council_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&),  -- 회계 기간은 겹치지 않는다
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE TABLE budget (
  id               uuid PRIMARY KEY,
  kind             text NOT NULL DEFAULT 'budget' CHECK (kind = 'budget'),
  fiscal_period_id uuid NOT NULL UNIQUE REFERENCES fiscal_period (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE account (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'account' CHECK (kind = 'account'),
  council_id     uuid NOT NULL,
  name           text NOT NULL,
  bank           text NOT NULL,
  account_number text NOT NULL,
  holder         text NOT NULL,  -- 예금주. 사람 이름이면 개인정보다(DEC-45)
  type           text NOT NULL CHECK (type IN ('main', 'business')),
  closed_on      date,
  UNIQUE (council_id, name),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX ON account (council_id) WHERE type = 'main' AND closed_on IS NULL;  -- 닫지 않은 대표 계좌는 하나다
--> statement-breakpoint
CREATE TABLE event (
  id                uuid PRIMARY KEY,
  kind              text NOT NULL DEFAULT 'event' CHECK (kind = 'event'),
  name              text NOT NULL,
  starts_at         timestamptz,
  ends_at           timestamptz CHECK (ends_at > starts_at),
  place             text,
  owner_id          uuid REFERENCES member (id),
  previous_event_id uuid REFERENCES event (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE budget_item (
  id        uuid PRIMARY KEY,
  kind      text NOT NULL DEFAULT 'budget_item' CHECK (kind = 'budget_item'),
  budget_id uuid NOT NULL REFERENCES budget (id),
  type      text NOT NULL CHECK (type IN ('income', 'expense')),  -- 수입 예산 항목과 지출 예산 항목(DEC-45)
  purpose   text NOT NULL,
  amount    numeric(14, 0) NOT NULL CHECK (amount >= 0),
  event_id  uuid REFERENCES event (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE income (
  id               uuid PRIMARY KEY,
  kind             text NOT NULL DEFAULT 'income' CHECK (kind = 'income'),
  fiscal_period_id uuid NOT NULL REFERENCES fiscal_period (id),
  source           text NOT NULL CHECK (source IN (
                     'fee', 'grant', 'participation_fee', 'carryover', 'business', 'donation', 'other')),
  amount           numeric(14, 0) NOT NULL CHECK (amount >= 0),
  received_on      date NOT NULL,
  description      text,
  budget_item_id   uuid REFERENCES budget_item (id),  -- 수입 예산 항목
  account_id       uuid REFERENCES account (id),      -- 돈이 들어온 계좌
  cancelled_at     timestamptz,                       -- 잘못 적은 수입은 지우지 않고 취소한다(DEC-45)
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE expense (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'expense' CHECK (kind = 'expense'),
  amount      numeric(14, 0) NOT NULL CHECK (amount >= 0),
  paid_at     timestamptz NOT NULL,
  description text NOT NULL,  -- 내역
  vendor      text NOT NULL,  -- 사용처
  method      text NOT NULL CHECK (method IN ('card', 'transfer', 'cash')),  -- 결제 수단. 누구 돈인지는 paid_by로 안다(DEC-45)
  reason      text,           -- 사유. 정산 전까지 채운다(DEC-40)
  event_id    uuid REFERENCES event (id),  -- 비면 상시 지출
  budget_item_id uuid REFERENCES budget_item (id),  -- 품목을 거치지 않는 지출의 예산 항목(DEC-36)
  requested_by  uuid REFERENCES member (id),  -- 요청을 거치지 않은 지출을 부탁한 사람(DEC-40)
  paid_by       uuid REFERENCES member (id),  -- 사비로 먼저 낸 운영진. 비면 학생회 돈으로 냈다(DEC-40)
  reimbursed_at timestamptz,                  -- 먼저 낸 운영진에게 환급한 시각
  account_id    uuid REFERENCES account (id), -- 돈이 나간 계좌. 사비로 먼저 낸 지출은 환급한 계좌
  cancelled_at  timestamptz,                  -- 잘못 적은 지출은 지우지 않고 취소한다(DEC-45)
  CHECK (reimbursed_at IS NULL OR paid_by IS NOT NULL),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE evidence (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'evidence' CHECK (kind = 'evidence'),
  expense_id uuid NOT NULL REFERENCES expense (id),
  type       text NOT NULL CHECK (type IN (
               'receipt', 'statement', 'tax_invoice', 'card_statement', 'transfer_confirmation',
               'item_photo', 'site_photo', 'stock_photo', 'other')),  -- 사진은 실물, 현장, 재고(DEC-45)
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE account_closing (
  id               uuid PRIMARY KEY,
  kind             text NOT NULL DEFAULT 'account_closing' CHECK (kind = 'account_closing'),
  fiscal_period_id uuid NOT NULL UNIQUE REFERENCES fiscal_period (id),
  published_at     timestamptz,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE fee_payment (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'fee_payment' CHECK (kind = 'fee_payment'),
  council_id uuid NOT NULL,
  student_id text NOT NULL,  -- 학번만 둔다(DEC-26)
  paid_from  date NOT NULL,
  paid_until date NOT NULL CHECK (paid_until >= paid_from),
  UNIQUE (council_id, student_id, paid_from),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
-- 일 --------------------------------------------------------------------

CREATE TABLE task (
  id            uuid PRIMARY KEY,
  kind          text NOT NULL DEFAULT 'task' CHECK (kind = 'task'),
  title         text NOT NULL,
  body          text,
  due_at        timestamptz,
  status        text NOT NULL,  -- 값은 프로토타입에서 정한다(DEC-22)
  recurrence    text,           -- 비면 반복하지 않는다
  event_id      uuid REFERENCES event (id),
  department_id uuid REFERENCES department (id),
  assignee_id   uuid REFERENCES member (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE request (
  id                     uuid PRIMARY KEY,
  kind                   text NOT NULL DEFAULT 'request' CHECK (kind = 'request'),
  type                   text NOT NULL CHECK (type IN ('purchase')),
  title                  text NOT NULL,
  body                   text,  -- 내용(왜 사는지)
  requested_by           uuid NOT NULL REFERENCES member (id),  -- 요청한 사람. 만든 사람과 다를 수 있다(DEC-40)
  needed_by              date,  -- 필요한 때
  default_budget_item_id uuid REFERENCES budget_item (id),
  cancelled_at           timestamptz,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE line_item (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'line_item' CHECK (kind = 'line_item'),
  request_id     uuid NOT NULL REFERENCES request (id),
  name           text NOT NULL,
  link           text,  -- 상품 링크
  options        text,  -- 옵션(색, 크기 등)
  quantity       integer NOT NULL CHECK (quantity > 0),
  amount         numeric(14, 0) CHECK (amount >= 0),  -- 승인할 때까지 비울 수 있다(DEC-40)
  budget_item_id uuid REFERENCES budget_item (id),    -- 승인할 때까지 비울 수 있다(DEC-40)
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE payment_line (
  id           uuid PRIMARY KEY,
  kind         text NOT NULL DEFAULT 'payment_line' CHECK (kind = 'payment_line'),
  expense_id   uuid NOT NULL REFERENCES expense (id),
  line_item_id uuid NOT NULL REFERENCES line_item (id),
  amount       numeric(14, 0) NOT NULL CHECK (amount >= 0),
  UNIQUE (expense_id, line_item_id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE registration_form (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'registration_form' CHECK (kind = 'registration_form'),
  event_id       uuid NOT NULL REFERENCES event (id),  -- 행사 하나에 여럿 둘 수 있다(DEC-44)
  name           text NOT NULL,
  opens_at       timestamptz,  -- 비면 만든 때부터 받는다
  closes_at      timestamptz NOT NULL CHECK (closes_at > opens_at),
  capacity       integer CHECK (capacity > 0),  -- 비면 정원이 없다
  notice         text,         -- 안내
  collects_phone boolean NOT NULL DEFAULT false,
  paused_at      timestamptz,  -- 멈추면 새 신청만 받지 않는다
  public_code    text NOT NULL UNIQUE,  -- 공개 링크의 코드. 포스터와 QR에 찍히므로 바꾸지 않는다
  payer_fee      numeric(14, 0) CHECK (payer_fee >= 0),
  non_payer_fee  numeric(14, 0) CHECK (non_payer_fee >= 0),
  fee_account_id uuid REFERENCES account (id),  -- 참가비 받는 계좌
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE registration (
  id           uuid PRIMARY KEY,
  kind         text NOT NULL DEFAULT 'registration' CHECK (kind = 'registration'),
  form_id      uuid NOT NULL REFERENCES registration_form (id),
  name         text,  -- 신청자 정보는 행사가 끝나고 1년 뒤 비운다(DEC-3)
  student_id   text,
  phone        text,
  applied_fee  numeric(14, 0) NOT NULL CHECK (applied_fee >= 0),  -- 신청 때 정한 값(DEC-26)
  cancelled_at timestamptz,
  CHECK (cancelled_at IS NULL OR (name IS NULL AND student_id IS NULL AND phone IS NULL)),  -- 취소하면 바로 비운다(DEC-3)
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE deposit (
  id              uuid PRIMARY KEY,
  kind            text NOT NULL DEFAULT 'deposit' CHECK (kind = 'deposit'),
  registration_id uuid NOT NULL REFERENCES registration (id),
  amount          numeric(14, 0) NOT NULL CHECK (amount >= 0),
  confirmed_at    timestamptz NOT NULL,
  income_id       uuid REFERENCES income (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE attendance (
  id              uuid PRIMARY KEY,
  kind            text NOT NULL DEFAULT 'attendance' CHECK (kind = 'attendance'),
  registration_id uuid NOT NULL REFERENCES registration (id),
  confirmed_at    timestamptz NOT NULL,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE meeting (
  id                 uuid PRIMARY KEY,
  kind               text NOT NULL DEFAULT 'meeting' CHECK (kind = 'meeting'),
  title              text NOT NULL,
  held_at            timestamptz NOT NULL,
  event_id           uuid REFERENCES event (id),
  host_department_id uuid REFERENCES department (id),  -- 비면 학생회 회의
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE agenda_item (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'agenda_item' CHECK (kind = 'agenda_item'),
  meeting_id uuid NOT NULL REFERENCES meeting (id),
  position   integer NOT NULL CHECK (position > 0),
  title      text NOT NULL,
  body       text,
  UNIQUE (meeting_id, position),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE poll (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'poll' CHECK (kind = 'poll'),
  title       text NOT NULL,
  closes_at   timestamptz,
  closed_at   timestamptz,
  origin_id   uuid,
  origin_kind text CHECK (origin_kind IN ('agenda_item', 'chat_room')),
  CHECK ((origin_id IS NULL) = (origin_kind IS NULL)),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (origin_id, origin_kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE poll_option (
  id       uuid PRIMARY KEY,
  kind     text NOT NULL DEFAULT 'poll_option' CHECK (kind = 'poll_option'),
  poll_id  uuid NOT NULL REFERENCES poll (id),
  position integer NOT NULL CHECK (position > 0),
  label    text NOT NULL,
  UNIQUE (poll_id, position),
  UNIQUE (id, poll_id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE poll_response (
  id        uuid PRIMARY KEY,
  kind      text NOT NULL DEFAULT 'poll_response' CHECK (kind = 'poll_response'),
  poll_id   uuid NOT NULL REFERENCES poll (id),
  member_id uuid NOT NULL REFERENCES member (id),
  option_id uuid NOT NULL,
  UNIQUE (poll_id, member_id),
  FOREIGN KEY (option_id, poll_id) REFERENCES poll_option (id, poll_id),  -- 고른 선택지가 그 투표의 것
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
-- 기록 ------------------------------------------------------------------

CREATE TABLE chat_room (
  id            uuid PRIMARY KEY,
  kind          text NOT NULL DEFAULT 'chat_room' CHECK (kind = 'chat_room'),
  type          text NOT NULL CHECK (type IN ('all_members', 'leadership', 'department', 'direct', 'inter_department')),
  event_id      uuid REFERENCES event (id),
  department_id uuid REFERENCES department (id),
  CHECK ((type = 'department') = (department_id IS NOT NULL)),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE room_membership (
  room_id   uuid NOT NULL REFERENCES chat_room (id),
  member_id uuid NOT NULL REFERENCES member (id),
  joined_at timestamptz NOT NULL,  -- 들어온 뒤의 메시지만 본다(DEC-20)
  last_read_at timestamptz,        -- 안 읽은 수를 셀 때 쓴다(screens.md)
  PRIMARY KEY (room_id, member_id)
);
--> statement-breakpoint
CREATE TABLE message (
  id        uuid PRIMARY KEY,
  kind      text NOT NULL DEFAULT 'message' CHECK (kind = 'message'),
  room_id   uuid NOT NULL REFERENCES chat_room (id),
  body      text NOT NULL,
  sent_at   timestamptz NOT NULL,
  is_notice boolean NOT NULL DEFAULT false,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE file (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'file' CHECK (kind = 'file'),
  name           text NOT NULL,
  media_type     text NOT NULL,
  size_bytes     bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key    text NOT NULL UNIQUE,  -- 파일 저장소의 위치
  attached_to_id uuid REFERENCES record (id),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE approval (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'approval' CHECK (kind = 'approval'),
  target_id   uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('request', 'line_item', 'expense', 'budget', 'account_closing', 'event')),
  outcome     text NOT NULL CHECK (outcome IN ('approved', 'rejected', 'audited', 'completed', 'completion_cancelled')),
  actor_id    uuid NOT NULL,
  actor_kind  text NOT NULL CHECK (actor_kind IN ('member', 'audit_body', 'voting_body')),
  acted_at    timestamptz NOT NULL,
  reason      text,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (target_id, target_kind) REFERENCES record (id, kind),
  FOREIGN KEY (actor_id, actor_kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE decision (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'decision' CHECK (kind = 'decision'),
  content     text NOT NULL,
  rationale   text,  -- 근거
  decided_by  uuid NOT NULL REFERENCES member (id),
  decided_at  timestamptz NOT NULL,
  origin_id   uuid,
  origin_kind text CHECK (origin_kind IN ('meeting', 'agenda_item', 'chat_room', 'poll')),
  CHECK ((origin_id IS NULL) = (origin_kind IS NULL)),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (origin_id, origin_kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE evidence_link (
  record_id  uuid NOT NULL REFERENCES record (id),
  message_id uuid NOT NULL REFERENCES message (id),
  PRIMARY KEY (record_id, message_id)
);
--> statement-breakpoint
CREATE TABLE document (
  id    uuid PRIMARY KEY,
  kind  text NOT NULL DEFAULT 'document' CHECK (kind = 'document'),
  title text NOT NULL,
  type  text NOT NULL CHECK (type IN ('general', 'result_report', 'minutes')),
  body  text,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE document_link (
  document_id uuid NOT NULL REFERENCES document (id),
  record_id   uuid NOT NULL REFERENCES record (id),
  PRIMARY KEY (document_id, record_id)
);
--> statement-breakpoint
CREATE TABLE draft_item (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'draft_item' CHECK (kind = 'draft_item'),
  record_id   uuid NOT NULL REFERENCES record (id),  -- 초안을 가진 기록(문서, 요청 등)
  position    integer NOT NULL CHECK (position > 0),
  content     text NOT NULL,
  needs_check boolean NOT NULL DEFAULT false,  -- "확인 필요"
  UNIQUE (record_id, position),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE source (
  id            uuid PRIMARY KEY,
  kind          text NOT NULL DEFAULT 'source' CHECK (kind = 'source'),
  draft_item_id uuid NOT NULL REFERENCES draft_item (id),
  origin_id     uuid NOT NULL,
  origin_kind   text NOT NULL CHECK (origin_kind IN ('message', 'file')),
  location      text NOT NULL,  -- 원문 안의 위치(메시지의 범위, 녹음의 시각)
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (origin_id, origin_kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE TABLE notification (
  id           uuid PRIMARY KEY,
  kind         text NOT NULL DEFAULT 'notification' CHECK (kind = 'notification'),
  recipient_id uuid NOT NULL REFERENCES member (id),
  record_id    uuid NOT NULL REFERENCES record (id),
  type         text NOT NULL CHECK (type IN ('mention', 'assignment', 'created', 'changed')),
  notified_at  timestamptz NOT NULL,
  read_at      timestamptz,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
-- 외래 키 인덱스 ---------------------------------------------------------
-- 기본 키나 UNIQUE의 첫 칸인 외래 키는 그 인덱스를 쓴다.

CREATE INDEX ON record (council_id);
--> statement-breakpoint
CREATE INDEX ON record (created_by);
--> statement-breakpoint
CREATE INDEX ON record (confirmed_by);
--> statement-breakpoint
CREATE INDEX ON record_version (changed_by);
--> statement-breakpoint
CREATE INDEX ON council_membership (cohort_id);
--> statement-breakpoint
CREATE INDEX ON department_membership (department_id);
--> statement-breakpoint
CREATE INDEX ON department_membership (cohort_id);
--> statement-breakpoint
CREATE INDEX ON budget_item (budget_id);
--> statement-breakpoint
CREATE INDEX ON budget_item (event_id);
--> statement-breakpoint
CREATE INDEX ON income (fiscal_period_id);
--> statement-breakpoint
CREATE INDEX ON income (budget_item_id);
--> statement-breakpoint
CREATE INDEX ON income (account_id);
--> statement-breakpoint
CREATE INDEX ON expense (event_id);
--> statement-breakpoint
CREATE INDEX ON expense (budget_item_id);
--> statement-breakpoint
CREATE INDEX ON expense (requested_by);
--> statement-breakpoint
CREATE INDEX ON expense (paid_by);
--> statement-breakpoint
CREATE INDEX ON expense (account_id);
--> statement-breakpoint
CREATE INDEX ON evidence (expense_id);
--> statement-breakpoint
CREATE INDEX ON event (owner_id);
--> statement-breakpoint
CREATE INDEX ON event (previous_event_id);
--> statement-breakpoint
CREATE INDEX ON task (event_id);
--> statement-breakpoint
CREATE INDEX ON task (department_id);
--> statement-breakpoint
CREATE INDEX ON task (assignee_id);
--> statement-breakpoint
CREATE INDEX ON request (default_budget_item_id);
--> statement-breakpoint
CREATE INDEX ON request (requested_by);
--> statement-breakpoint
CREATE INDEX ON line_item (request_id);
--> statement-breakpoint
CREATE INDEX ON line_item (budget_item_id);
--> statement-breakpoint
CREATE INDEX ON payment_line (line_item_id);
--> statement-breakpoint
CREATE INDEX ON registration_form (event_id);
--> statement-breakpoint
CREATE INDEX ON registration_form (fee_account_id);
--> statement-breakpoint
CREATE INDEX ON registration (form_id);
--> statement-breakpoint
CREATE INDEX ON deposit (registration_id);
--> statement-breakpoint
CREATE INDEX ON deposit (income_id);
--> statement-breakpoint
CREATE INDEX ON attendance (registration_id);
--> statement-breakpoint
CREATE INDEX ON meeting (event_id);
--> statement-breakpoint
CREATE INDEX ON meeting (host_department_id);
--> statement-breakpoint
CREATE INDEX ON poll (origin_id);
--> statement-breakpoint
CREATE INDEX ON poll_response (member_id);
--> statement-breakpoint
CREATE INDEX ON poll_response (option_id, poll_id);
--> statement-breakpoint
CREATE INDEX ON chat_room (event_id);
--> statement-breakpoint
CREATE INDEX ON chat_room (department_id);
--> statement-breakpoint
CREATE INDEX ON room_membership (member_id);
--> statement-breakpoint
CREATE INDEX ON message (room_id);
--> statement-breakpoint
CREATE INDEX ON file (attached_to_id);
--> statement-breakpoint
CREATE INDEX ON approval (target_id);
--> statement-breakpoint
CREATE INDEX ON approval (actor_id);
--> statement-breakpoint
CREATE INDEX ON decision (decided_by);
--> statement-breakpoint
CREATE INDEX ON decision (origin_id);
--> statement-breakpoint
CREATE INDEX ON evidence_link (message_id);
--> statement-breakpoint
CREATE INDEX ON document_link (record_id);
--> statement-breakpoint
CREATE INDEX ON source (draft_item_id);
--> statement-breakpoint
CREATE INDEX ON source (origin_id);
--> statement-breakpoint
CREATE INDEX ON notification (recipient_id, read_at);
--> statement-breakpoint
CREATE INDEX ON notification (record_id);
--> statement-breakpoint
-- 로그인 잇기: 로그인 계정(users)과 운영진(member)을 하나씩 잇는다(G1)
CREATE TABLE member_login (
  member_id uuid PRIMARY KEY REFERENCES member (id),
  user_id   text NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- 초대 코드: 학생회마다 하나(G2). 형식은 지금 vada와 같다
CREATE TABLE invite_code (
  council_id uuid PRIMARY KEY REFERENCES council (id),
  code       text NOT NULL UNIQUE CHECK (code ~ '^[2-9A-HJ-NP-Z]{8}$'),
  created_by uuid NOT NULL REFERENCES member (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX ON invite_code (created_by);
--> statement-breakpoint
-- 알림 받을 기기(G10). 구독 주소는 기기를 가리키는 비밀 주소다
CREATE TABLE push_device (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1024),
  p256dh          text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth            text NOT NULL CHECK (char_length(auth) <= 100),
  expiration_time timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX ON push_device (user_id);
