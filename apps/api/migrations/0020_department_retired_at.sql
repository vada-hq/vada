-- 쓴 부서 그만 쓰기(기능 023 조각 7, DEC-91). 그만 쓴 시각을 두고, 그만 쓴 부서는 조직 화면과 고르는 칸에서 빠진다.
-- 넓히기만 하는 새 칸(NULL 허용)이라 지금 행이 어길 것이 없다. 새 칸을 읽는 코드보다 먼저 두 DB에 적용한다.
ALTER TABLE department ADD COLUMN retired_at timestamptz;
