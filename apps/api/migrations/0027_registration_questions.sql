-- Custom SQL migration file, put your code below! --
-- 신청 양식의 질문·선택지와 신청의 답(DEC-93, 기능 025 조각 21, 표 바꿈 T5의 질문 부분).
-- 새 표만 더해 지금 행이 어길 수 있는 제약이 없다. 그것을 읽는 코드보다 먼저 두 DB에 적용한다.
-- 셋 다 기록이 아니다(shipment_item, meeting_attendee와 같은 꼴). 질문·선택지는 양식의 설정이고 신청이 한 명이라도 있으면 바꾸지 않는다(앱이 409).
-- 그래서 답과 어긋난 옛 질문이 생기지 않아 판이 지킬 이력이 없고, 신청 0명일 때 바꾸면 행을 지우고 다시 넣는다.
-- 답은 신청자 정보다. 판을 두지 않고 비울 때(입금 전·후 취소, 기한, 학생회 파기) 행을 지워 어디에도 남지 않게 한다(DEC-55).
-- 같은 학생회인지는 양식·신청 기록의 학생회로 앱이 확인한다(RULE-50과 같은 꼴).
CREATE TABLE registration_question (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  form_id uuid NOT NULL CONSTRAINT registration_question_form_id_fk REFERENCES registration_form (id),
  position integer NOT NULL CONSTRAINT registration_question_position_check CHECK (position > 0),
  kind text NOT NULL CONSTRAINT registration_question_kind_check CHECK (kind IN ('short_text', 'single_choice', 'multiple_choice')),
  title text NOT NULL CONSTRAINT registration_question_title_check CHECK (char_length(title) BETWEEN 1 AND 100),
  required boolean NOT NULL DEFAULT false,
  CONSTRAINT registration_question_form_position_key UNIQUE (form_id, position),
  CONSTRAINT registration_question_id_form_key UNIQUE (id, form_id)
);
--> statement-breakpoint
-- 선택지는 번호가 있는 행이다. 선택지별 정원은 이 표에 칸을 더하면 된다(P0-4).
-- form_id는 학생회 파기 차례(destroy.ts)가 양식 번호로 지우려고 둔다. (질문, 양식) 외래 키로 질문의 양식과 맞춘다.
CREATE TABLE registration_question_choice (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  question_id uuid NOT NULL,
  form_id uuid NOT NULL,
  position integer NOT NULL CONSTRAINT registration_question_choice_position_check CHECK (position > 0),
  label text NOT NULL CONSTRAINT registration_question_choice_label_check CHECK (char_length(label) BETWEEN 1 AND 50),
  CONSTRAINT registration_question_choice_question_position_key UNIQUE (question_id, position),
  CONSTRAINT registration_question_choice_id_question_key UNIQUE (id, question_id),
  CONSTRAINT registration_question_choice_question_fk FOREIGN KEY (question_id, form_id) REFERENCES registration_question (id, form_id)
);
--> statement-breakpoint
CREATE INDEX registration_question_choice_form_id_idx ON registration_question_choice (form_id);
--> statement-breakpoint
-- 답 한 행: 짧은 답은 글 하나, 하나 고르기는 선택지 하나, 여럿 고르기는 고른 선택지마다 한 행이다. 답하지 않은 질문은 행이 없다.
CREATE TABLE registration_answer (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  registration_id uuid NOT NULL CONSTRAINT registration_answer_registration_id_fk REFERENCES registration (id),
  question_id uuid NOT NULL CONSTRAINT registration_answer_question_id_fk REFERENCES registration_question (id),
  choice_id uuid,
  text_value text CONSTRAINT registration_answer_text_value_check CHECK (char_length(text_value) BETWEEN 1 AND 200),
  CONSTRAINT registration_answer_value_check CHECK ((choice_id IS NULL) <> (text_value IS NULL)),
  CONSTRAINT registration_answer_choice_fk FOREIGN KEY (choice_id, question_id) REFERENCES registration_question_choice (id, question_id),
  CONSTRAINT registration_answer_registration_question_choice_key UNIQUE NULLS NOT DISTINCT (registration_id, question_id, choice_id)
);
--> statement-breakpoint
CREATE INDEX registration_answer_question_id_idx ON registration_answer (question_id);
--> statement-breakpoint
CREATE INDEX registration_answer_choice_id_idx ON registration_answer (choice_id);
