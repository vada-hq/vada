-- 업무 결과물(기능 015, DEC-82, RULE-41). 업무와 그 업무에서 만든 결과물을 잇는 연결 표다. 기록이 아니라 판이 없고, 떼지 않는다.
-- 새 표만 더하므로 기존 행을 깨지 않는다. 이 표를 읽는 코드보다 먼저 두 DB에 적용한다.
-- 결과물 하나는 업무 하나에만 이어진다(UNIQUE result_id). 같은 학생회인지는 앱이 본다(records/same-council.ts).
CREATE TABLE task_result (
  task_id     uuid NOT NULL REFERENCES task (id),
  result_id   uuid NOT NULL,
  result_kind text NOT NULL CHECK (result_kind IN ('request', 'registration_form', 'message', 'event')),
  PRIMARY KEY (task_id, result_id),
  UNIQUE (result_id),
  FOREIGN KEY (result_id, result_kind) REFERENCES record (id, kind)
);
