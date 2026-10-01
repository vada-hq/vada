# 배송 등록·조회 API

2026-09-30 구현 단계. Neon 미반영, 화면 미연결. 웹훅 수신·작업 실행기는 구현했으나 활성화하지 않았다. [실행기와 검증 절차](delivery-worker.md)를 참고한다. 실제 자동 갱신 검증이 끝난 기능으로 안내하지 않는다.

## 범위와 책임

- `deliveries/routes.ts`: 인증·소속·재정부 권한, Origin, JSON 본문과 크기 제한, 응답 코드.
- `validation.ts`: 엄격한 입력 검증. 택배사와 송장번호 모두 필수이며 자동 추정하지 않는다. 송장번호는 앞자리 0을 유지하는 문자열이다.
- `service.ts`: 승인 품목 검증, 연결 이력, 등록 멱등성, 트랜잭션, 공유 응답 최소화, 대기 작업 저장.
- `provider.ts` / `delivery-tracker.ts`: 외부 조회 인터페이스와 Delivery Tracker 어댑터. 키·외부 오류 원문·수취인 정보를 응답하거나 기록하지 않는다.
- `status.ts`: 외부 상태를 내부 상태로 변환한다. 구매 승인 상태는 변경하지 않는다.
- 계약 타입은 `packages/contracts/src/deliveries.ts`, DB 구조는 `docs/ERD.md`에서 관리한다.

## 엔드포인트

아래 경로의 공통 접두사는 `/api/organizations/:organizationId`다. 모두 로그인·동일 학생회 소속이 필요하고 응답은 `Cache-Control: no-store`다.

| 메서드·경로 | 권한 | 입력 / 결과 |
|---|---|---|
| GET `/delivery-carriers` | 재정부 | `after`, `search` 선택. 최대 50개와 `nextCursor` |
| POST `/delivery-lookups` | 재정부 | `carrierId`, `trackingNumber`. 조회만 수행하며 저장하지 않음 |
| POST `/shipments` | 재정부 | 위 두 값 + `purchaseItemIds`, `idempotencyKey`. 등록 201, 재시도 200 |
| GET `/events/:eventId/deliveries` | 전체 구성원 | 승인 품목 최대 50개, 품목별 활성 배송 연결. `after`, `nextCursor` |
| POST `/shipments/:shipmentId/unlink` | 재정부 | `linkIds`. 연결 해제, 이력 보존 |

POST는 서비스와 동일한 Origin과 `application/json`이 필요하다. 본문 최대 16KiB. 배열은 중복 없는 1~50개 ID이며 미정의 필드는 거부한다. 송장번호는 영문·숫자·하이픈만 허용하므로 ISO 시각을 쓰는 더미 송장은 별도 실험 스크립트에서 검증한다.

등록 예:

```json
{
  "carrierId": "kr.coupangls",
  "trackingNumber": "000123456789",
  "purchaseItemIds": ["item-id"],
  "idempotencyKey": "새 등록 의도마다 생성한 UUID"
}
```

등록은 외부 재조회 후 권한·승인 여부를 트랜잭션 안에서 다시 확인한다. 한 호출에는 같은 요청서의 품목만 지정한다. 같은 학생회·택배사·송장번호는 기존 배송을 재사용한다. 별도 호출로 합배송·분할배송을 연결할 수 있다. 송장 조회 성공은 해당 상품의 송장이라는 증거가 아니므로 연결 정확성은 재정부가 확인해야 한다.

사용자는 택배사를 항상 선택하고 송장번호를 입력한다. 임시 화면은 조회 결과 확인 후 등록 API를 호출하도록 연결한다. 재조회 실패 시 이번 등록은 저장하지 않으며 기존 상태는 보존한다.

같은 등록 키와 입력은 기존 결과를 반환하며 외부 조회·재연결을 반복하지 않는다. 같은 키에 다른 입력은 409다. 명시적으로 재연결할 때는 새 키를 사용한다. 해제는 조회 응답의 `linkId`를 사용한다. 오래된 해제 요청은 새 연결을 해제하지 않는다. 송장 수정은 잘못된 연결 해제 후 새 송장을 등록하는 방식이며 원본 송장을 덮어쓰는 API는 없다.

## 공유와 상태

전체 구성원 응답에는 품목 ID·요청 ID·상품명·주문 수량과 배송 요약만 포함한다. 재정부는 송장 원문, 나머지는 마스킹된 송장을 본다. 요청 목적·원본 상품 정보·근거 대화·승인 이력은 포함하지 않는다. 배송 수량 배분이 없으므로 품목이나 요청서의 전체 배송 완료를 추론하지 않는다.

공식 [상태 코드](https://tracker.delivery/docs/api-schema/enums/track-event-status-code)를 다음처럼 묶는다. 픽업 단계는 아직 수취 완료가 아니므로 진행 중으로 표현한다.

| 외부 코드 | 내부 상태 |
|---|---|
| INFORMATION_RECEIVED | pending |
| AT_PICKUP / IN_TRANSIT / OUT_FOR_DELIVERY / AVAILABLE_FOR_PICKUP | in_transit |
| DELIVERED | delivered |
| ATTEMPT_FAIL / EXCEPTION | exception |
| UNKNOWN / 알 수 없는 코드 / 이벤트 없음 | unknown |

미등록은 활성 연결이 없는 상태다. `lastEventAt`은 배송 이벤트 시각, `lastCheckedAt`은 조회 성공 시각이다. `trackingActive`는 추적 의도이며 외부 등록 완료를 뜻하지 않는다. `webhookExpiresAt`은 외부 등록 성공 후 기록하는 만료 시각이며, 실행기가 멈추면 갱신되지 않는다.

## 활성화와 후속 작업

- 기본 비활성화. `DELIVERY_ENABLED=true`일 때만 라우트를 연결한다.
- 서버 설정: `DELIVERY_TRACKER_CLIENT_ID`, `DELIVERY_TRACKER_CLIENT_SECRET`. 브라우저에 전달하지 않는다.
- 활성화 전에 마이그레이션 0005~0007 적용과 실행기 상시 구동 환경을 준비해야 한다. 이 작업에서는 실제 환경 설정을 읽거나 DB에 적용하지 않았다.
- 외부 호출 제한: 사용자별 동시 1개, 분당 20개. 단일 프로세스 메모리 제한이므로 다중 인스턴스 전에는 공유 제한기로 바꾼다. 외부 요청 제한 시간은 15초다.
- 오류: 400 입력, 401 로그인, 403 권한·Origin, 404 대상·배송 조회 없음, 409 미승인·등록 키 충돌, 413 본문 크기, 415 형식, 429 호출 제한, 502 외부 조회 실패, 503 키 미설정. 내부 오류는 상세 없이 500이다.
- 후속 작업: 실제 외부 API·Neon·웹훅 검증, 실행 환경 결정, 임시 등록 화면 연결. 웹훅 URL의 비밀 토큰 검사는 발신자 서명 인증이 아니며 상태는 인증 API로 재조회한다.

외부 연동 기준: [인증](https://tracker.delivery/docs/authentication), [조회 API](https://tracker.delivery/docs/tracking-api).
