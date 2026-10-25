---
독자: 에이전트
---

# 022 대화를 와이어프레임에 맞추기

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 10시간(실제로 도는 시간). 조각이 11개라 처음 기본값(6시간에 7개)의 비율로 잡았다. 넘으면 늘리지 않고 조각 7(1:1 열기)을 다음 기능으로 넘긴다. 시작은 진행 에이전트가 적는다. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/022-조각번호`, 진행 기록은 `.superpowers/sdd/022/progress.md`.

## 왜

학생회의 공지는 지금 회장단이 운영진 전체방 메시지에 공지 표시를 붙인 것이고, 대화 칸·띠·모아 보기·홈 부분 네 곳에 따로 보인다. 와이어프레임(Figma `B5OHqrl9bbvXCUkhME4Sfo`의 US-MSG-01, EVT-MSG-01, MSG-01~04, HOME-01 메시지함, P-05·P-06)은 공간마다의 공지방에 보낸 메시지를 공지로 두고, 홈에 안 읽은 방 칩을, 행사마다 공지방·부서방을 둔다. 대화에서 받은 쿠팡 링크로 요청을 만들면 품목을 처음부터 다시 적어야 하고, 같은 메시지로 요청이 두 번 생겨도 모른다. 공지방에 모두가 쓰면 공지가 반응에 묻힐 수 있다. 이 기능은 사용자가 확인한 결정(DEC-90)대로 공지를 공지방으로 바꾸고, 홈 메시지함·대화 목록·쿠팡 상품 정보(DEC-89)·메시지 아래 기록·1:1 열기·행사 방·답글을 넣는다.

- 입력(이미 정함): DEC-90(대화를 와이어프레임에 맞추기), DEC-89(ReefAPI). 표 1(와이어프레임 그대로)·표 2(와이어프레임과 다르게)는 DEC-90 '결정'에 있다. 이 명세가 가리키는 proposal('구현 묶음')·research·codex-review는 저장소 밖의 로컬 노트이고, 필요한 것은 이 명세와 DEC-90에 옮겨 두었다.
- 근거 결정: DEC-18(방), DEC-20·48(들어오기 전), DEC-28(권한), DEC-37·38(행사 방은 탭과 목록 양쪽), DEC-50(사진), DEC-57(지금 기수), DEC-59(알림 100자), DEC-61·89(쿠팡), DEC-69·76(홈), DEC-71(메시지에서 요청·지출, 근거), DEC-73(새 요청), DEC-81(요청과 예산 항목 같은 행사), DEC-82(업무 결과물), DEC-83(행사 끝은 상태).
- 기대는 일: 지금 기수 판단 고치기(DEC-57, 가지 `work/fix-current-cohort`, 온보딩 묶음 1). 같은 기수 판정이 그 도우미를 쓴다.

### 원칙 대조

- 새로 하는 입력: 없다. 공지는 공지방에 보내는 보통 메시지라 표시를 붙이는 일이 없어진다. 쿠팡 품목 이름은 불러온 값을 확인만 하고, 못 불러오면 지금처럼 적는다. 답글은 고르는 동작 하나가 늘지만 덕(공지방 흐름이 공지만 남음)은 그 방을 보는 모두가 바로 본다.
- 근거 연결: 메시지에서 만든 요청·지출은 지금처럼 그 메시지를 근거로 저장하고(DEC-71), 이제 메시지 아래에 보인다. 불러온 상품 정보는 초안이다('불러온 정보' 표시, 사람이 고침, PRIN-2).
- 변경 이력: 메시지와 답글은 지금처럼 `createRecord` 판 1이다. 행사 방 만들기·참여 맞추기는 지금 편성 방과 같다. 보관은 저장하지 않는 계산 값(행사 상태)이라 이력이 없다.

## 범위 밖

- DEC-90의 '첫 주 뒤'와 '미룸': 부서 간 방(`chat_room`에 부서 칸이 하나뿐이라 표를 바꿀 수 있다), 메시지에서 업무 만들기, 방의 링크 모아 보기.
- 구매 후보 보드, 메시지 옮기기, 일반 파일 첨부, 방 만들기·인원 추가·나가기, 공지방 보내기 권한 설정, 공지 고정, 홈 공지, 모두 부르기.
- `message.is_notice` 칸 지우기(표를 바꾸고 얻는 것이 없다), 방 유일 인덱스.
- 불러온 가격·배송을 품목에 저장하기(`line_item`에 칸이 없고 금액은 승인 때 정한다, DEC-40). 상품 사진, 쿠팡 밖 쇼핑몰의 정보 불러오기, 단축 주소 풀기.
- 우리 학생회 공간 화면(옆 메뉴 영역), 재정 쪽 차이(구매 목적 초안, 제출 권한, 증빙 공개 범위), 업무 영역의 '공지 만들기' 다시 보기.
- 방마다 알림 끄기(RFC-7 '되도록'). 넣을 때 공지방은 끄지 못하게 한다(DEC-90).

## 정한 것

DEC-90과 DEC-89는 다시 정하지 않는다. 코드로 옮기려고 더 정한 것은 아래 근거로 정했다.

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 1 공지방 판정 | 공지방은 `all_members` 종류의 방이다(학생회는 `event_id` 없음, 행사는 있음). 판정은 `plan-room.ts`의 한 조건이고 보내기·보이기·업무 공지가 모두 그것을 쓴다. 이름은 화면 '공지방', 행사 방은 '{행사 이름} 공지방' | DEC-90, 자주 잡힌 것 12·13 | 쉽다 |
| 2 들어오기 전 보이기 | 보이는 메시지 = 들어온 뒤 것, 또는 공지방 메시지 중 보낸 시각이 보는 사람의 지금 기수 기간에 드는 것. 방 흐름, 사진 보기(`photos.ts`), 근거 잇기(`source-message.ts`), 방 줄 미리보기, 안 읽은 수가 한 도우미(`visibleMessage`)를 쓴다. 안 읽은 수에도 넣어, 늦게 들어온 사람의 홈 메시지함에 공지방이 나온다 | DEC-48 맥락(아무도 첫 공지를 못 봄), DEC-90, 자주 잡힌 것 12 | 쉽다 |
| 3 업무의 공지 만들기 | `SendMessageSchema`의 `notice`를 빼고 `taskId`만 둔다. `taskId`가 있으면 공지방(행사에 이은 업무면 그 행사 공지방, 조각 8 뒤)에서만 받고 `task_result(result_kind 'message')`로 잇는다. 단계는 올리면 끝남(`notice_posted` 이름 유지), 떼면 빠짐은 없다 | DEC-82가 DEC-90으로 바뀜, RULE-41 | 쉽다 |
| 4 `is_notice` | 칸은 남기고 새 메시지는 늘 false로 쓴다. 읽는 코드는 없다 | DEC-90 범위 밖(표 바꿈) | 쉽다 |
| 5 홈 메시지함 자료 | 홈 계약을 바꾸지 않고 대화 목록 읽기(`GET .../rooms`)를 그대로 쓴다. 홈은 이미 원래 화면의 읽기를 쓴다(`useHomeExtras`). 같은 응답이라 보이는 방과 수가 대화 목록과 같다 | `home/useHomeExtras.ts` 주석, 자주 잡힌 것 12 | 쉽다 |
| 6 칩 차례와 자리 | 안 읽은 1:1(뒤에 부서 간)을 마지막 메시지 최근 순으로 먼저, 남은 자리에 안 읽은 다른 방을 최근 순으로, 3개. 칩은 '{방 이름} {수}'(99+). 자리는 숫자 카드 바로 아래, 두 단 위 전체 폭. '전체 보기'는 대화. 1:1 칩은 '{상대 이름} · 1:1'(이름이 없으면 '1:1 대화')로 적어 색만으로 가르지 않는다([WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)). | DEC-90, 와이어프레임 HOME-01 MessageInbox | 쉽다 |
| 7 첫 방 | 기억한 방이 있고 아직 들었으면 그 방. 없으면 학생회 직급이 있으면 회장단방, 부서 소속이 있으면 방 차례의 첫 부서방, 아니면 공지방. 휴대폰은 지금처럼 목록을 먼저 보이고 차례는 바꾸지 않는다(목록 자리가 날마다 바뀌지 않게) | DEC-90, Slack 마지막 채널 기억, NN/g Empty states(자리 고정) | 쉽다 |
| 8 방 줄 | `RoomSummary.lastMessage: { senderName: string \| null; preview: string } \| null`, `memberCount: number`. 미리보기는 보는 사람에게 보이는 방 흐름의 마지막 메시지 첫 줄 앞 100자(DEC-59 알림과 같은 길이), 사진만이면 `PUSH_PHOTO_BODY`. 답글은 넣지 않는다(조각 10). 줄은 '{보낸 사람}: {미리보기}'와 '{n}명' | DEC-90, `RoomRow.tsx` | 쉽다(늘리기) |
| 9 내 말풍선 | 오른쪽 `bg-primary text-primary-foreground`. 말풍선 안 링크는 같은 글자색에 밑줄. 글자 대비 4.5:1 이상 | DEC-90, [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 쉽다 |
| 10 ReefAPI 호출 | `POST https://api.reefapi.com/coupang/v1/product`, 본문 `{"product_id": <정규화한 상품 주소>}`(상품 id, item id, 전체 상품 주소를 모두 받는다), `content-type: application/json`. `max_rotations`는 기본(4)을 둔다. 응답 `{ ok, data, meta, error }`, `data.items[]`(그 상품 id의 판매 단위마다 이름·가격·정가·할인·배송·도착 예정·item id·vendor item id), `data.item`(쿠팡이 맨 앞에 둔 것), `data.price_range` | [ReefAPI Coupang](https://reefapi.com/docs/coupang)("Look up ONE Coupang product by id", 2 credits), [ReefAPI docs](https://reefapi.com/docs) | 쉽다 |
| 11 인증·환경 변수 | 헤더 `x-api-key`. 키는 서버 환경 변수 `REEF_API_KEY` 하나다. 없으면 불러오기만 꺼지고 서버는 시작한다(휴대폰 알림 `push/config.ts`와 같은 선택 값). 필수 목록(`runtime.ts`)에 넣지 않고 `.env.example`과 Render에 둔다. 키는 로그·응답·Sentry에 넣지 않는다 | [ReefAPI 인증](https://reefapi.com/docs#authentication) "Pass your key as the `x-api-key` header", DEC-89 | 쉽다 |
| 12 비용 | 한 번에 2 credits, 실패한 호출은 무료(SHEIN 예외만 과금). 무료 1,000 credits(500번), Pro 월 $15(연 결제면 $7.5)에 10,000 credits(5,000번), 남은 credits는 없어지지 않는다. 잔액은 `GET https://api.reefapi.com/account/v1/credits`(무료, 시간에 몇 번만). 응답 `meta.charged_credits`, 헤더 `X-Credits-Remaining` | [ReefAPI 가격](https://reefapi.com/pricing), [docs#credits](https://reefapi.com/docs#credits) | 쉽다 |
| 13 보내는 주소 | 받는 링크는 `coupang.com`·`www.coupang.com`의 `/vp/products/{숫자}`와 `m.coupang.com`의 `/vm/products/{숫자}`뿐이다. 보낼 때 `https://www.coupang.com/vp/products/{id}`에 `itemId`·`vendorItemId`(숫자일 때)만 붙이고 나머지 쿼리(검색어 `q`, `searchId`, 추적 값)는 버린다. 그 밖의 주소(단축 주소 `link.coupang.com`·`coupa.ng`, 다른 쇼핑몰)는 부르지 않는다. ReefAPI에는 이 주소만 보내고 사람·학생회·메시지는 보내지 않는다 | DEC-89("상품 주소만 보낸다"), DEC-90(단축 주소는 링크만), ReefAPI 문서에 단축 주소 언급 없음 | 쉽다 |
| 14 고른 판매 단위 | 주소의 `itemId`(없으면 `vendorItemId`)와 같은 `items[]` 줄, 없으면 `data.item`. 품목 이름은 그 줄의 이름이다. 옵션 칸은 비운다: 문서가 "the option/variant attribute list"를 주지 않는다고 적는다(미확인: `items[]`의 `name`에 옵션 글이 드는지, 조각 4의 확인 단계) | [ReefAPI Coupang](https://reefapi.com/docs/coupang) "You do NOT get: … the option/variant attribute list" | 쉽다 |
| 15 우리 API | `POST /api/organizations/:councilId/product-info`, 본문 `ProductInfoSchema = { url }`(`token(PURCHASE_ITEM_LINK_MAX)`, http·https만). 응답 `ProductInfoResponse = { product: ProductInfo \| null; reason: 'unsupported' \| 'not_found' \| 'unavailable' \| null }`, `ProductInfo = { name, items: { itemId, name, price, listPrice }[], selectedItemId, shipping, deliveryEta, rocket }`. 불러오기 실패는 200이고 `product: null`이다(막지 않는다, DEC-89). 권한은 그 학생회 운영진(`council.view`). 아무것도 바꾸지 않지만 credits를 쓰므로 공통 가드(출처 확인)가 걸리는 변경 경로 모양으로 둔다 | AGENTS.md '새 API', `http/guard.ts` | 쉽다(늘리기) |
| 16 실패 | `NOT_FOUND`(404) → `not_found`. 시간 초과, `TARGET_BLOCKED`·`PARSE_ERROR`(502), `UPSTREAM_TIMEOUT`(504), `RATE_LIMITED`(429), `QUOTA_EXCEEDED`(402), `AUTH_FAILED`(401), `DISABLED`(503), `INTERNAL`(500), 연결 실패, 키 없음, `ok`가 아니거나 모양이 다른 응답 → `unavailable`. 서버는 다시 시도하지 않는다(ReefAPI가 출구를 바꿔 최대 4번 시도하고, 사람은 패널을 다시 열면 된다). 시간 제한 10초 | [docs#errors](https://reefapi.com/docs#errors), [NN/g 응답 시간 한계 10초](https://www.nngroup.com/articles/response-times-3-important-limits/), 실측 지연 5.0초(Coupang 문서 예시)·0.5~13.6초(ReefAPI 첫 화면) | 쉽다 |
| 17 캐시 | ReefAPI는 저장하지 않는다("Every call fetches live data"). 우리 서버 메모리에 정규화한 주소를 열쇠로 성공과 `not_found`를 10분, 500개까지 둔다(넘으면 오래된 것부터 버림). `unavailable`은 두지 않는다(실패는 무료이고 차단은 곧 풀릴 수 있다). 서버가 하나라 메모리로 맞다(`http/rate-limit.ts`와 같은 전제) | DEC-89 "같은 상품 주소는 짧게 저장", [docs](https://reefapi.com/docs), 가격은 초안이고 승인 때 정함(DEC-40) | 쉽다 |
| 18 속도 제한 | 계정마다 1분에 20번(`createRateLimiter`), 넘으면 429. ReefAPI 키 한도(엔드포인트마다 3초에 30번) 아래에 둔다 | [docs#rate-limits](https://reefapi.com/docs#rate-limits), 기능 003 '서버 메모리' | 쉽다 |
| 19 성공률 | 호출마다 결과 종류만 한 줄 로그(`product_info outcome=ok\|not_found\|blocked\|timeout\|quota\|auth\|other`, 캐시면 `cached`). 주소·학생회·사람은 넣지 않는다. `quota`와 `auth`는 사람이 손볼 일이라 경고 단계 | DEC-89 결과("성공률을 센다"), AGENTS.md '로그·비밀' | 쉽다 |
| 20 상품 정보 패널 | 쿠팡 상품 링크(13의 모양)만 파란 글자 링크이고, 누르면 PC는 오른쪽 패널, 휴대폰은 전체 화면으로 연다. 다른 링크는 지금처럼 새 탭. 패널: 제목 '상품 정보', '불러온 정보' 표시, 상품명, 판매 단위 목록(이름·가격, 정가와 다르면 정가), 배송, 도착 예정, 로켓 표시, [쿠팡에서 열기](새 탭), [구매 요청 만들기](그 메시지로, 이 상품을 고른 판매 단위로). 불러오는 동안 자리 표시, 실패면 '상품 정보 없음'과 [쿠팡에서 열기]만 | DEC-89, DEC-90, 와이어프레임 상품 정보 패널 | 쉽다 |
| 21 링크로 품목 | '구매 요청 만들기'는 메시지의 링크마다(같은 주소는 하나, `PURCHASE_ITEMS_MAX`까지) 품목을 만들어 링크를 채우고 링크 아래 판매처(호스트에서 `www.`·`m.`을 뺀 것)를 보인다. 판매처는 저장하지 않는다(링크로 계산). 쿠팡 상품 링크는 불러온 이름을 품목 이름에 채우고(사람이 고침) 고른 판매 단위의 가격을 '불러온 가격 {n}원'으로 보이되 보내지 않는다. 링크가 없으면 지금처럼 빈 품목 하나 | DEC-90, DEC-40(금액은 승인 때), `request-seed.ts` | 쉽다 |
| 22 메시지 아래 기록 | `ChatMessage.made: { kind: 'purchase_request' \| 'expense'; id; title }[]`(요청 제목, 지출 내역). 보는 사람이 그 기록을 볼 수 있을 때만 싣는다. 줄은 '구매 요청 · {제목}', '지출 · {내역}'이고 누르면 그 상세. 번호는 없다(요청에 번호 칸이 없음) | DEC-90, DEC-71, PRIN-5 | 쉽다 |
| 23 다시 만들기 막기 | 같은 메시지로 만든 요청 가운데 반려·취소가 아닌 것이 있으면 새 요청은 409 `SOURCE_MESSAGE_USED`, 취소되지 않은 지출이 있으면 새 지출도 같다. 요청과 지출은 서로 막지 않는다. 그 메시지 행을 잠근 거래에서 본다(동시에 둘이 와도 하나). 메뉴는 막힌 동작 대신 '구매 요청 보기'·'지출 보기'를 보인다 | DEC-71 결과, DEC-73(반려 뒤 새 요청) | 쉽다 |
| 24 1:1 열기 | 보낸 사람 이름, 업무 담당자, 운영진 목록의 이름을 누르면 그 사람과의 1:1(`OpenDirectSchema`, 지금 API). 나 자신과 떠난 사람은 누르지 못한다. 입력칸 첫 글자가 `/`면 보내지 않고 이름 고르기(부르기 입력 `useMentionInput`과 같은 방식)를 띄우고, 고르면 1:1을 연다. PC는 오른쪽 패널(호박색 머리, 상대 이름, 보내기 버튼 '{이름}에게 보내기', 한 번에 하나), 휴대폰은 1:1 방 전체 화면 | DEC-90, [Slack split view](https://slack.com/help/articles/47144721728275-Use-split-view-in-Slack), [Slack Connect 띠](https://slack.com/intl/en-gb/help/articles/25084875810707-Adjust-Slack-Connect-banner-visibility)(받는 사람 표시), 와이어프레임 MSG-04 | 쉽다 |
| 25 행사 방 만들기 | 행사를 만드는 거래에서 공지방(`all_members`, `event_id`)과 지금 부서마다 부서방(`department`, `event_id`)을 만든다. 이미 있는 행사는 학생회 방 채우기(`ensureCouncilRooms`)처럼 읽을 때 채운다. 편성·부서가 바뀌면 보관되지 않은 행사의 방 참여도 맞춘다(`syncRooms`). 같은 방이 둘 생기지 않게 지금처럼 학생회 행을 잠근다. 표는 바꾸지 않는다 | DEC-90, DEC-12, `api/chat/rooms.ts` | 보통(데이터가 생김) |
| 26 보관 | 행사 상태가 `completed`면 그 방은 보관이다. 저장하지 않고 상태로 계산한다(DEC-83). 보내기·답글은 409 `ROOM_ARCHIVED`, 대화 목록·홈 칩·대화 배지 합계·휴대폰 알림에서 뺀다. 행사 메시지 탭에서는 읽기만이고 입력칸 자리에 '완료된 행사' 표시. 완료를 취소하면 다시 열린다. vada에는 '취소됨' 상태가 없어 완료만 본다 | DEC-90, [Slack 보관](https://slack.com/help/articles/213185307-Archive-or-delete-a-channel) "you can unarchive", DEC-83, `contracts/events.ts` `EVENT_STATUSES` | 쉽다 |
| 27 목록의 행사 방 | 메시지가 생긴 행사 방만 '행사' 묶음에 행사마다 '{행사 이름} 공지방', '{행사 이름} {부서 이름} 방'으로 둔다. `RoomSummary.eventId`·`eventName`을 더한다 | DEC-90(첫 메시지 뒤 목록), [Slack 채널 이름 접두사](https://slack.com/help/articles/217626408-Create-guidelines-for-channel-names) | 쉽다 |
| 28 행사 메시지 탭 | 행사 탭 줄 맨 앞 '메시지'(`?tab=messages`), 기본 탭이 된다. 위 행사 요약 줄 대신 방 전환('공지방', 내 부서마다 '{부서} 방'), 탭과 방마다 안 읽은 배지. 회장단이 부서가 없으면 공지방만 | DEC-90, 와이어프레임 EVT-MSG-01, Teams 채널 첫 탭 Posts(research-R1-R2) | 쉽다 |
| 29 행사 방의 요청 | 행사 방 메시지에서 연 요청은 그 행사를 고른 채로 시작한다(바꿀 수 있음). 업무의 '공지 만들기'는 업무가 행사에 이었으면 그 행사의 공지방에 올린다 | DEC-90, DEC-81 | 쉽다 |
| 30 답글 표 | `message`에 `reply_to_id uuid` (NULL 허용)를 더하고, `message`에 `UNIQUE (id, room_id)`를 두어 `(reply_to_id, room_id)` → `message (id, room_id)` 외래 키로 답글이 원글과 같은 방임을 DB가 막는다. `reply_to_id` 인덱스. 한 단계(원글이 답글이 아님)는 서버가 막는다 | DEC-90, AGENTS.md '마이그레이션'(외래 키 칸 인덱스, 같은 묶음은 복합 외래 키) | 보통(칸 지우기는 따로) |
| 31 답글 계약 | `SendMessageSchema.replyTo`(선택). 방 흐름(`GET .../messages`)은 원글만 주고, `ChatMessage`에 `replyCount`, `lastReplyAt`을 더한다. 답글은 `GET .../rooms/:roomId/messages/:messageId/replies`(지금 메시지 쪽 읽기와 같은 커서). 원글이 보이지 않으면 404. 답글에 답글은 400 `INVALID_INPUT` | DEC-90, Slack·Teams 한 단계 | 쉽다(늘리기) |
| 32 답글 읽음·알림 | 답글도 방의 안 읽은 수에 센다(방 단위 `last_read_at` 그대로). 화면은 방을 열 때의 이전 읽은 시각보다 뒤 답글이 있는 원글에 '새 답글'을 보인다. 휴대폰 알림은 원글 쓴 사람, 그 원글에 답글을 쓴 사람, 부른 사람에게만(나와 보는 중인 사람 빼고, 지금 규칙) | DEC-90, Teams 채널 답글 활동 | 쉽다 |
| 33 문구 | 와이어프레임의 설명 글은 옮기지 않는다. 라벨: '공지방', '메시지함', '전체 보기', '상품 정보', '불러온 정보', '쿠팡에서 열기', '불러온 가격', '구매 요청 보기', '지출 보기', '답글', '답글 {n}', '새 답글', '완료된 행사' | AGENTS.md '화면 문구와 폼' | 쉽다 |

## 위험

- **외부 서비스(처음, 깊게).** 서버가 밖으로 HTTP를 부르는 첫 코드다. 부르는 함수는 `AppOptions`로 넣어 시험은 가짜로 돌고 실제 네트워크에 닿지 않는다. 10초 제한, 응답 모양 검사(zod `safeParse`, 모르는 모양은 `unavailable`), 응답 크기 상한(문서 예시의 검색 응답이 2.5MB라 상품 응답도 크게 잡고 5MB에서 끊는다)을 둔다. 쿠팡 약관 위험은 DEC-89가 진다. 쿠팡이 문제를 삼으면 `REEF_API_KEY`를 빼서 끈다(코드 배포 없이 사람이 Render에서).
- **미확인(조각 4의 확인 단계).** 문서가 판매 단위의 옵션 이름 목록을 주지 않는다고 적고, `items[]`의 `name`에 옵션 글이 드는지, 전체 주소의 `itemId`로 고른 줄이 맞는지, 응답이 실제로 몇 초인지 적지 않는다. 진행 에이전트가 키로 상품 주소 셋(옵션 있는 것, `itemId` 있는 것, 없는 상품)을 한 번씩 불러(6 credits) 결과 모양만 진행 기록에 적는다(가격·이름 값은 적지 않아도 된다). 옵션 글이 이름에 들면 정한 것 14의 옵션 칸을 그 글로 채우는 것으로 고친다. DEC-89의 '옵션, 옵션별 가격'은 판매 단위 목록과 가격으로 이룬다.
- **새 환경 변수.** `REEF_API_KEY`는 선택 값이라 CI 운영 모드 시작의 가짜 값이 필요 없다. `.env.example`, Render 설정에 더한다.
- **표 바꾸기(조각 10, 깊게).** 새 칸을 읽는 코드이므로 진행 에이전트가 main에 올리기 전에 개발 DB에 적용하고, 운영 DB는 main CI가 배포 전에 적용한다. `UNIQUE (id, room_id)`는 기본 키가 `id`라 기존 행이 어길 수 없다. `db/schema.ts`를 같이 고쳐 `schema-match.test.ts`를 통과한다. 새 표가 없어 public 표 수 시험은 그대로다. vada-docs `logical-model.md` '메시지' 줄과 답글 RULE을 같은 때에 고친다(DEC-90 결과).
- **보이는 범위가 넓어짐(깊게).** 늦게 들어온 같은 기수 운영진이 공지방의 잡담까지 본다. vada-docs `legal/privacy-policy.md` 11조 2항을 조각 1과 같은 때에 고친다(DEC-90 결과). 다른 기수·다른 방·다른 학생회의 메시지가 새지 않는지 같은 모양의 자료로 시험한다(자주 잡힌 것 6, 11).
- **학생회 격리(깊게).** 방 줄 미리보기, 메시지 아래 기록, 행사 방 참여, 상품 정보 경로(다른 학생회 `councilId`), 답글 읽기마다 거르기를 지우면 실패하는 시험.
- **동시 처리(깊게).** 같은 메시지로 두 요청이 동시에 오는 경우, 행사 만들기와 편성 바꾸기가 겹쳐 행사 방이 둘 생기는 경우. 실제 PostgreSQL 점검(`pg-smoke`)에 두 경우를 더해 진행 에이전트가 돌린다.
- **넓은 걷기(조각 1).** 공지 계약·라우트·화면·권한을 걷으면 `pnpm knip`이 남은 내보내기를 잡는다. `src/ui-gallery`, `scripts/manage-demo-data.ts`·`manage-test-data.ts`·`pg-smoke.ts`, `ops/pg-smoke/pg-smoke-notice-case.ts`, 권한표 시험(`policy`)이 함께 바뀐다. 리허설 흐름 시험이 실패하면 배포하지 않는다.
- **같은 파일을 나란히.** `MessageItem.tsx`, `useMessageActions.ts`, `RoomView.tsx`, `contracts/chat.ts`를 조각 1·3·5·6·7·11이 고친다. 아래 '먼저 main에'를 지키고, 나중에 합치는 쪽이 그 부품 시험을 세 번 돈다.

### 사람이 시작 전에 할 일

- ReefAPI 가입과 키 발급, 요금제 고르기(무료 1,000 credits는 500번이라 시범 운영에는 Pro 이상). 키를 vada `.env`의 `REEF_API_KEY`와 Render 환경 변수에 넣는다. 크레딧 잔액은 ReefAPI 대시보드에서 주마다 본다.

## 조각

차례는 proposal '구현 묶음'이다. 1~6은 시범 운영 첫날 전, 8~9는 첫 행사 전, 7과 10~11은 시기를 따로 묶지 않는다. 4는 외부 서비스라 먼저 기대는 것이 없어 맨 처음 시작한다(오르막 먼저). 2는 1과 나란히 만들고 1보다 먼저 또는 함께 main에 올린다(홈 공지가 빠지는 날 홈에서 공지방에 닿는 길). 시간이 모자라면 7을 넘긴다.

### 1. 공지방과 공지 걷기(서버와 화면) [x]
- 먼저 main에: `work/fix-current-cohort`(DEC-57). 조각 2(또는 같이 올림).
- 할 수 있게 되는 것: 모든 운영진이 공지방에 보내고, 늦게 들어온 같은 기수 운영진이 공지방의 이전 메시지와 사진을 본다.
- 수용 기준: 대화 목록과 방 머리에 '운영진 전체방' 대신 '공지방'이 보인다. 모든 운영진이 공지방에 보낸다. 늦게 들어온 같은 기수 운영진이 공지방 흐름에서 들어오기 전 메시지와 그 사진을 보고(사진 주소도 열림), 그 메시지로 요청을 만들어 근거로 잇는다. 다른 기수의 공지방 메시지와 부서방·회장단방·1:1의 들어오기 전 메시지는 흐름·사진·근거 잇기 어디서도 열리지 않는다(404). 공지방의 안 읽은 수에 같은 기수의 들어오기 전 메시지가 든다. '공지로 표시'·'공지 해제' 메뉴, 흐름의 '공지' 배지, 전체방 위 띠, 대화 첫 화면의 공지 칸, `?tab=notices`, 홈 '공지' 부분이 없다. `POST .../messages/:messageId/notice`와 `GET .../notices`는 404이고 `notice` 키를 보내면 400이다. 권한 목록에 `chat.notice`가 없다. 업무 상세의 '공지 만들기'로 올리면 공지방에 보통 메시지가 생기고 업무가 끝남이 되며 이력에 까닭이 남는다. 공지방이 아닌 방에 `taskId`를 보내면 400이다. 리허설 흐름 시험이 통과한다.
- 닿는 곳: api `chat/notice.ts`(지움), `chat/routes.ts`, `chat/send.ts`, `chat/messages.ts`(`shownNotice`·`noticesOf` → 공지방 보이기), `chat/plan-room.ts`, `chat/photos.ts`, `chat/source-message.ts`, `chat/queries.ts`, `chat/stage.ts`, `tasks/results.ts`, `policy/`, `ops/pg-smoke/pg-smoke-notice-case.ts`, `scripts/manage-demo-data.ts`·`manage-test-data.ts`. contracts `chat.ts`(`MarkNoticeSchema`, `NoticeListResponse`, `RECENT_NOTICE_COUNT`, `NOTICE_LIST_MAX`, `RoomListResponse.notices`, `RoomSummary.noticeRoom`, `ChatMessage.isNotice`, `SendMessageSchema`), `permissions.ts`, `paths.ts`. web `chat/chat-view.ts`, `NoticeEntry.tsx`·`NoticeBand.tsx`·`NoticePage.tsx`·`useNotices.ts`·`notice-seen.ts`·`useNoticeMark.ts`(지움), `useMessageActions.ts`, `MessageItem.tsx`, `RoomView.tsx`, `RoomList.tsx`, `home/NoticesSection.tsx`(지움)·`HomeBody.tsx`·`home-view.ts`·`useHomeExtras.ts`, `tasks/NoticeMakeDialog.tsx`, `ui-gallery/`. vada-docs `legal/privacy-policy.md` 11조 2항, `logical-model.md` RULE-30·31·41.
- 검토: 깊게(보이는 범위, 학생회 격리, 권한). 마이그레이션: 없음.

### 2. 홈 메시지함(화면) [x]
- 먼저 main에: 없음(1과 나란히).
- 할 수 있게 되는 것: 네 역할 모두 홈에서 안 읽은 방을 보고 바로 연다.
- 수용 기준: 안 읽은 방이 있으면 숫자 카드 바로 아래 '메시지함'에 칩이 정한 것 6의 차례로 3개까지 있고, 칩은 방 이름과 수만 보인다. 칩을 누르면 그 방이 열린 대화 화면이고, '전체 보기'는 대화 방 목록이다. 안 읽은 방이 없거나 목록을 읽지 못하면 부분째 없고 홈의 다른 부분은 그대로다. 들지 않은 방은 칩에 없다(대화 목록과 같은 응답). 옆 메뉴 '대화'의 합계 배지는 그대로다. 390px에서 칩이 넘치지 않는다(`wrap-anywhere`).
- 닿는 곳: web `home/HomeBody.tsx`·`useHomeExtras.ts`·`home-view.ts`, 메시지함 부품(새, `home/`), `chat/useRoomList.ts`, `chat/chat-view.ts`(방 이름), `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 3. 대화 목록과 첫 방, 내 말풍선(서버 계약과 화면) [x]
- 먼저 main에: 조각 1.
- 할 수 있게 되는 것: 방 목록에서 마지막 말과 인원을 보고, 대화를 열면 내 부서방이 먼저 열린다.
- 수용 기준: `GET .../rooms`의 방마다 `lastMessage`(보낸 사람 이름, 미리보기)와 `memberCount`가 있다. 미리보기는 보는 사람에게 보이는 마지막 메시지이고(들어오기 전 부서방 메시지는 미리보기에도 없다, 같은 모양의 다른 학생회 자료로 시험), 사진만이면 '사진'이다. 방 줄은 '{보낸 사람}: {미리보기}'와 '{n}명'을 보인다. 기억한 방이 없는 기기에서 대화를 열면 부서원은 부서방, 회장단은 회장단방, 부서가 없는 사람은 공지방이 열린다. 기억한 방에서 빠졌으면 같은 차례로 고른다. 내 메시지는 오른쪽 파란 말풍선이고 안의 링크가 보인다. `MessageItem.tsx`의 회색 이유 주석이 고쳐진다.
- 닿는 곳: contracts `chat.ts`(`RoomSummary`), api `chat/queries.ts`, web `chat/RoomRow.tsx`, `last-room.ts`, `ChatPage.tsx`, `MessageItem.tsx`, `test-support`의 방 자료, `ui-gallery/`.
- 검토: 깊게(미리보기의 보이는 범위). 마이그레이션: 없음.

### 4. 쿠팡 상품 정보 불러오기(서버, ReefAPI) [x]
- 먼저 main에: 없음. 시작 전에 사람이 키를 넣는다(위). 확인 단계(위험 '미확인')를 진행 에이전트가 이 조각을 올리기 전에 한다.
- 할 수 있게 되는 것: 운영진의 화면이 쿠팡 상품 주소로 상품명·판매 단위별 가격·배송을 받는다.
- 수용 기준: `POST /api/organizations/:councilId/product-info`에 쿠팡 상품 주소를 보내면 `product`가 오고, 가짜 ReefAPI가 받은 본문은 정한 것 13의 정규화한 주소 하나뿐이며 헤더에 `x-api-key`가 있다. 주소의 `itemId`와 같은 판매 단위가 `selectedItemId`다. 단축 주소·다른 쇼핑몰은 ReefAPI를 부르지 않고 `reason: 'unsupported'`, ReefAPI `NOT_FOUND`는 `not_found`, 정한 것 16의 나머지와 10초 시간 초과·모양이 다른 응답·키 없음은 `unavailable`이고 모두 200이다. 같은 주소(쿼리만 다른 것 포함)를 10분 안에 다시 보내면 ReefAPI를 부르지 않는다. `unavailable` 뒤에는 다시 부른다. 계정마다 1분 21번째는 429다. 로그에는 결과 종류만 있고 주소·키가 없다. 다른 학생회 `councilId`는 403, 로그인하지 않으면 401, 빈 값·`javascript:`·2001자·모르는 키는 400. 키가 없어도 서버가 시작한다.
- 닿는 곳: contracts 상품 정보 계약(새, `ProductInfoSchema`·`ProductInfoResponse`), `index.ts`, api 상품 정보 모듈(새: 주소 정규화, ReefAPI 부르기, 캐시, 라우트), `app.ts`(`AppOptions`)·`serve.ts`, `http/boundary.test.ts`, `.env.example`.
- 검토: 깊게(외부 서비스, 비밀 값). 마이그레이션: 없음.
- main: 5d60c88, 56aabb8. 그 뒤 고친 것: 같은 주소의 진행 중인 요청은 함께 기다려 ReefAPI를 한 번만 부른다. 판매 단위는 줄마다 검사해 한 줄이 틀려도 나머지를 주고, 고른 판매 단위는 늘 목록 안의 줄이다(실제 키 확인에서 한 상품의 판매 단위가 41개). 서버 전체 하루 150번(한국 날짜, `apps/api/src/product-info/service.ts`의 `REEF_CALLS_PER_DAY`)을 넘으면 부르지 않고 `unavailable`이다.

### 5. 메시지 아래 기록과 다시 만들기 막기(서버) [ ]
- 먼저 main에: 조각 1(`ChatMessage` 계약).
- 할 수 있게 되는 것: 메시지를 읽는 사람이 그 메시지로 만든 요청·지출을 알고, 같은 메시지로 같은 기록이 두 번 생기지 않는다.
- 수용 기준: 메시지에서 요청을 만들면 그 방의 메시지 응답에 `made`(구매 요청, 제목)가 있고, 지출도 같다. 그 기록을 볼 수 없는 사람의 응답에는 없다. 같은 메시지로 반려·취소되지 않은 요청이 있으면 새 요청은 409 `SOURCE_MESSAGE_USED`이고 아무것도 남지 않는다. 그 요청이 반려되거나 취소되면 새 요청이 된다. 지출도 같다(취소되지 않은 지출이 있으면 409). 요청이 있는 메시지로 지출은 된다. 같은 메시지로 요청 둘을 동시에 보내면 하나만 생긴다(pg-smoke). 근거 없이 만든 요청은 그대로다.
- 닿는 곳: contracts `chat.ts`(`ChatMessage.made`), `errors.ts`(`SOURCE_MESSAGE_USED`), api `chat/messages.ts`, `chat/source-message.ts`, `purchases/service.ts`, `expenses/service.ts`, `ops/pg-smoke/`, web `lib/messages.ts`.
- 검토: 깊게(동시 처리, 보이는 범위). 마이그레이션: 없음.

### 6. 상품 정보 패널과 링크로 품목 채우기, 메시지 아래 기록(화면) [ ]
- 먼저 main에: 조각 4, 조각 5, 조각 3(`MessageItem.tsx`).
- 할 수 있게 되는 것: 대화의 쿠팡 링크를 눌러 상품 정보를 보고, 메시지에서 연 요청의 품목이 링크로 채워지며, 메시지 아래에서 만든 기록으로 간다.
- 수용 기준: 쿠팡 상품 링크를 누르면 PC는 오른쪽, 390px는 전체 화면으로 '상품 정보'가 열려 정한 것 20을 보이고, 불러오지 못하면 '상품 정보 없음'과 [쿠팡에서 열기]만 있다. 다른 링크는 새 탭이다. 메시지 '…' → '구매 요청 만들기'는 링크마다 품목을 만들어 링크와 판매처를 보이고, 쿠팡 상품 링크는 불러온 이름과 '불러온 가격'을 보이며, 불러오는 동안에도 양식을 쓸 수 있고 고친 이름을 불러온 값이 덮지 않는다. 보낸 요청의 품목에 링크와 이름이 있고 금액은 없다. 패널의 [구매 요청 만들기]는 고른 판매 단위의 이름으로 채운다. 불러온 이름이 품목 이름 상한(`PURCHASE_ITEM_NAME_MAX`)보다 길면 상한에서 잘라 채운다(쿠팡 상품명은 길어 그대로 채우면 보내기가 400, 022 조각 4 검토). 메시지 아래에 '구매 요청 · {제목}'·'지출 · {내역}'이 있고 누르면 그 상세다. 막힌 메시지의 메뉴에는 '구매 요청 보기'·'지출 보기'가 있다. 409 문구는 보내기 버튼 옆에 보인다.
- 닿는 곳: web `chat/message-links.ts`, `MessageItem.tsx`, 상품 정보 패널(새, `chat/`), 상품 정보 읽기 훅(새), `request-seed.ts`, `RequestFlowView.tsx`, `useRequestFlow.ts`, `MessageMenu.tsx`·`useMessageActions.ts`, `finance/request-form.ts`, `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 7. 이름 누르기와 `/이름`으로 1:1 열기(화면) [ ]
- 먼저 main에: 조각 3.
- 할 수 있게 되는 것: 어느 화면에서든 사람 이름을 눌러 그 사람에게 바로 말한다.
- 수용 기준: 메시지 보낸 사람, 업무 담당자, 운영진 목록의 이름을 누르면 그 사람과의 1:1이 열린다(없으면 지금 API가 만든다). 내 이름과 떠난 사람은 눌리지 않는다. 입력칸 첫 글자가 `/`면 보내지 않고 이름 목록이 뜨고, 고르면 1:1이 열린다. PC에서는 지금 화면 오른쪽 패널로 열리고 머리가 다른 색이며 보내기 버튼이 '{이름}에게 보내기'다. 다른 이름을 누르면 패널이 그 사람으로 바뀌고 쓰던 글은 방마다 남는다. 390px에서는 1:1 방이 전체 화면이다. 패널의 [닫기]로 돌아간다.
- 닿는 곳: web 1:1 패널(새, `chat/` 또는 `workspace/`), `chat/MessageItem.tsx`, `Composer.tsx`·`useMentionInput.ts`, `DirectDialog.tsx`, `tasks/`의 담당자 표시, `team/`의 사람 목록, `workspace/WorkspaceFrame.tsx`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 8. 행사 방과 보관(서버) [ ]
- 먼저 main에: 조각 1(공지방 판정·보이기), 조각 3(`RoomSummary`).
- 할 수 있게 되는 것: 행사마다 공지방과 부서방이 생기고, 완료된 행사의 방은 읽기만 된다.
- 수용 기준: 행사를 만들면 공지방(모든 운영진)과 부서마다 부서방(그 부서 소속)이 생기고, 이미 있는 행사도 방 목록을 읽으면 생긴다. 부서를 옮기면 보관되지 않은 행사 부서방 참여가 바뀐다. 행사 만들기와 편성 바꾸기가 겹쳐도 방은 하나씩이다(pg-smoke). 행사 공지방에도 조각 1의 들어오기 전 규칙이 맞다. 학생회 편성 방을 고르는 조회가 행사 방을 잡지 않는다(`isPlanRoom`). 대화 목록에는 메시지가 있는 행사 방만 `eventId`·`eventName`과 함께 있다. `GET /api/organizations/:councilId/events/:eventId/rooms`(`EventRoomsResponse { rooms: RoomSummary[]; archived: boolean }`)는 메시지가 없어도 그 행사의 공지방과 내 부서방을 준다. 다른 학생회의 행사는 404다. 행사가 완료되면 보내기·답글은 409 `ROOM_ARCHIVED`, 목록·합계 배지·알림에서 빠지고 읽기는 된다. 완료를 취소하면 다시 보낸다. 행사 방 메시지로 만든 요청·근거 잇기가 된다. 행사에 이은 업무의 공지 만들기는 그 행사 공지방에 올린다.
- 닿는 곳: api `chat/rooms.ts`, `chat/plan-room.ts`, `chat/queries.ts`, `chat/room-access.ts`, `chat/send.ts`, `chat/notify.ts`, `events/`(만들기 거래), `team/`(편성 바꾸기), `tasks/results.ts`, contracts `chat.ts`(`RoomSummary.eventId`·`eventName`, 행사 방 응답), `errors.ts`(`ROOM_ARCHIVED`), `ops/pg-smoke/`. vada-docs `logical-model.md`(보관 RULE).
- 검토: 깊게(동시 처리, 학생회 격리, 데이터가 생김). 마이그레이션: 없음.

### 9. 행사 메시지 탭과 목록의 행사 방(화면) [ ]
- 먼저 main에: 조각 8, 조각 2(홈 칩), 조각 6(`RequestFlowView.tsx`).
- 할 수 있게 되는 것: 행사 화면에서 그 행사의 공지방·부서방으로 대화하고, 거기서 연 요청이 그 행사에 이어진다.
- 수용 기준: 행사 상세의 탭 줄 맨 앞이 '메시지'이고 기본 탭이며(`?tab=messages`), 그 탭에서는 요약 줄 대신 방 전환 '공지방 · {부서} 방'과 방마다 안 읽은 배지가 있고 탭 배지는 그 합이다. 행사 방 메시지에서 연 요청은 그 행사가 골라진 채로 열리고 바꿀 수 있다. 대화 목록의 '행사' 묶음에 메시지가 생긴 행사 방이 행사 이름과 함께 있다. 홈 메시지함의 행사 방 칩은 그 행사의 메시지 탭을 그 방으로 연다. 완료된 행사의 메시지 탭은 읽기만이고 입력칸 자리에 '완료된 행사'가 있으며, 목록·홈 칩에 그 방이 없다. 390px에서 탭 줄과 방 전환이 넘치지 않는다.
- 닿는 곳: web `events/EventDetailView.tsx`·`event-view.ts`, 행사 메시지 탭(새, `events/` 또는 `chat/`), `chat/RoomView.tsx`·`RoomList.tsx`·`chat-view.ts`, `chat/RequestFlowView.tsx`, `finance/request-form.ts`, `home/` 메시지함, contracts `paths.ts`(행사 탭), `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 10. 답글(마이그레이션과 서버) [ ]
- 먼저 main에: 조각 8(보이기·보관), 조각 5(`ChatMessage`). 진행 에이전트가 개발 DB에 먼저 적용한다.
- 할 수 있게 되는 것: 메시지에 답글을 달고, 방 흐름에는 원글만 남는다.
- 수용 기준: `replyTo`를 주어 보내면 답글이 생기고 방 흐름 응답에는 원글만 있으며 원글의 `replyCount`·`lastReplyAt`이 는다. 답글 읽기는 원글 아래 답글을 보낸 순으로 준다. 다른 방의 메시지·답글·보이지 않는 원글에 답글은 400·404이고 아무것도 남지 않는다. DB에 직접 다른 방의 원글을 가리키는 행을 쓰면 외래 키가 막는다. 답글도 방의 안 읽은 수에 들고, 방 줄 미리보기에는 들지 않는다. 휴대폰 알림은 원글 쓴 사람, 그 원글에 답글을 쓴 사람, 부른 사람에게만 간다(방의 다른 사람에게는 없음). 공지방 답글도 같은 기수면 들어오기 전 것을 본다. 보관된 방의 답글은 409 `ROOM_ARCHIVED`. 답글로도 요청·지출을 만들고 근거로 잇는다.
- 닿는 곳: `apps/api/migrations/`(새), `db/schema.ts`, `db/schema-match.test.ts`, contracts `chat.ts`(`SendMessageSchema.replyTo`, `ChatMessage`, 답글 응답), api `chat/send.ts`, `chat/messages.ts`, `chat/queries.ts`, `chat/notify.ts`, `chat/routes.ts`. vada-docs `logical-model.md`('메시지' 줄, 답글 RULE).
- 검토: 깊게(표, 학생회 격리, 알림 받는 사람). 마이그레이션: 있음(적용 먼저).

### 11. 답글(화면) [ ]
- 먼저 main에: 조각 10, 조각 6·7(`MessageItem.tsx`, 오른쪽 패널).
- 할 수 있게 되는 것: 공지에 대한 질문과 반응을 답글로 달고 읽는다.
- 수용 기준: 메시지 '…'과 메시지 위 단추에 '답글'이 있고(답글에는 없음), 누르면 PC는 오른쪽 패널, 390px는 전체 화면으로 원글과 답글, 답글 입력칸이 열린다. 방 흐름의 원글 아래 '답글 {n}'과 마지막 답글 시각이 있고, 방을 열 때의 이전 읽은 시각 뒤 답글이 있으면 '새 답글'이 보인다. 답글 입력칸도 사진·부르기·보내기 실패 보존이 방 입력칸과 같고, 쓰던 글은 원글마다 남는다. 휴대폰 알림을 눌러 답글이 열린다.
- 닿는 곳: web 답글 패널(새, `chat/`), `chat/MessageItem.tsx`, `MessageMenu.tsx`·`useMessageActions.ts`, `useRoom.ts`, `Composer.tsx`·`composer-drafts.ts`, `chat-api.ts`, 알림을 누른 주소(`paths.ts`), `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

기기 확인은 사람이 하고 `docs/device-checks.md`의 새 절 '대화'에 옮긴다. A는 회장(데스크톱 Chrome), B는 부원(아이폰, 학생회에 나중에 들어옴), C는 재정부(갤럭시).

1. A가 공지방에 사진과 글을 올린 뒤 초대 링크를 돌린다 → B가 들어와 홈 메시지함의 공지방 칩으로 그 글과 사진을 본다. 공지 표시 메뉴와 홈 공지가 없다.
2. B가 대화를 연다 → 부서 배정 뒤 부서방이 먼저 열린다. 방 줄에 마지막 말과 인원이 있다.
3. B가 부서방에 쿠팡 상품 링크를 올린다 → C가 링크를 눌러 상품 정보를 보고 '구매 요청 만들기'로 품목 이름이 채워진 요청을 낸다 → 메시지 아래 '구매 요청 · {제목}'이 있고 같은 메뉴는 '구매 요청 보기'다.
4. A가 B의 이름을 눌러 1:1을 오른쪽 패널로 연다.
5. A가 행사를 만든다 → 행사 메시지 탭에 공지방과 부서방, 거기서 연 요청이 그 행사로 시작한다. 완료하면 탭은 읽기만이고 목록에서 빠진다.
6. B가 공지방 글에 답글을 단다 → 공지방 흐름에는 원글과 '답글 1', A에게 휴대폰 알림이 온다.

지표와 회고 세 줄은 이 아래에 적는다.
