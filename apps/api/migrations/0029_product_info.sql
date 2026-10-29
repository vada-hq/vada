-- 메시지에 쿠팡 상품 링크가 오면 보낼 때 한 번 ReefAPI로 불러 둔 상품 정보(기능 022 정한 것 17, 대표 결정 2026-10-29).
-- 읽기는 이 값을 그대로 쓰고, 사람이 새로고침할 때만 다시 불러 덮어쓴다. 기간을 두지 않는다.
-- 열쇠는 정규화한 상품 주소(itemId·vendorItemId까지)다. 상품 정보는 공개 정보이고 학생회·사람·메시지를 담지 않아
-- 학생회 파기·탈퇴와 무관하다(DEC-89 '상품 주소만 보낸다'). not_found도 결과라 둔다. 일시 실패(unavailable)는 두지 않는다.
-- product는 응답의 ProductInfo(가져온 시각 빼고)다. 서버는 JSON 32KB를 넘으면 두지 않고, 이 상한은 jsonb 글자의 여유분까지 잡은 마지막 막이다.
CREATE TABLE product_info (
  url text PRIMARY KEY CHECK (char_length(url) <= 2048),
  outcome text NOT NULL CHECK (outcome IN ('ok', 'not_found')),
  product jsonb CHECK (octet_length(product::text) <= 65536),
  fetched_at timestamptz NOT NULL,
  CHECK ((outcome = 'ok') = (product IS NOT NULL))
);
