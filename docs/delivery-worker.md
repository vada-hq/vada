# 배송 자동 갱신 백엔드

2026-09-30. 로컬 PGlite·가짜 외부 API로 검증한 구현이다. 개발용 Neon `production` 브랜치에 0005~0007 마이그레이션을 적용했다. 배포·활성화는 아직 수행하지 않았다. 외부 웹훅 연결은 일회용 스키마에서 더미 송장으로만 확인했다(아래 "실제 웹훅 연동 검증").

### 실제 환경 확인 기록

- 기존 0000~0004 마이그레이션 해시·순서 확인 후 개발용 DB에만 0005~0007 적용.
- 배송 테이블 4개와 `tracking_version` 컬럼 생성 확인.
- 적용 전후 구매요청서 4건·품목 4건의 전체 행 해시가 같아 데이터 유지 확인.
- Delivery Tracker 인증 및 더미 송장 조회 성공. 제품용 웹훅 → 작업 실행기 → DB 반영은 아래 검증에서 더미 송장으로 확인.

### 실제 웹훅 연동 검증 (`apps/api/scripts/check-delivery-webhook-live.ts`)

개발용 DB 안의 일회용 `delivery_probe_<UUID>` 스키마에 `shipments`·`shipment_jobs`를 복제하고, 제품 webhook·worker·provider 코드를 그대로 사용한다. `public` 데이터는 건드리지 않는다. ngrok 터널(→ `127.0.0.1:8898`)로 공개하고 최대 10분 대기 후 테스트 등록 만료·스키마 삭제를 수행한다.

2026-09-30 ~ 10-02(KST) 다섯 차례 실행했다. 1~4차는 `DELIVERY_WEBHOOK_PROBE_FAILED stage=callback_and_refresh`, 수신기 수정 후 5차는 `LIVE_WEBHOOK_DB_UPDATE_OK`이다.

| 단계 | 5차 결과 (2026-10-01T17:12Z 등록) |
|---|---|
| 임시 스키마·격리(`search_path`) | 성공 |
| 공개 터널 `/health` | 성공 (수신기 로그에 GET 200 기록) |
| worker의 외부 등록(`register`) | 성공 |
| 등록 직후 보완 조회 → DB 반영 | 성공 (`refresh` 완료 1건, 상태 `in_transit`) |
| 콘솔 Trigger → 외부 콜백 도착 | 성공 (17:14:34Z `POST` 202, 처리 437ms) |
| 콜백 → refresh 작업 저장 | 성공 (202는 작업 커밋 뒤에만 반환) |
| worker 인증 재조회 → DB 반영 | 성공 (17:14:37Z `lastCheckedAt` 갱신, `refresh` 완료 2건, 오류 없음) |
| 정리 (등록 만료·스키마 삭제) | 성공, 잔존 `delivery_probe_*` 스키마 0건 확인 |

**원인과 수정.** 실제 콜백 본문은 공식 문서의 `carrierId`, `trackingNumber` 외에 문서에 없는 `projectId`(문자열)를 포함한다. 수신기가 허용 외 키를 400으로 거절해 모든 콜백이 버려지고 있었다. `webhook.ts`는 이제 모르는 필드를 읽지 않고 무시하며, 두 필드의 타입과 저장된 배송과의 일치만 검사한다. 토큰 검사·4KiB 제한·일치 검사·본문 비저장은 그대로다.

경과:

- 1차: Trigger를 두 번 눌렀으나 202 로그 없음. 당시 스크립트는 202만 기록해 미도착과 거부를 구분할 수 없었다.
- 2차: 모든 수신 요청을 시각·메서드·경로 종류(health/webhook/other)·응답 코드로 기록하도록 보강. 10분 동안 콜백 0건. 이 창 안에 Trigger를 눌렀는지는 확인되지 않았다.
- 3차: Trigger 약 2분 뒤 `POST webhook 400`, 약 7분 30초 뒤 한 번 더 400(재시도로 보임). 토큰(404)·Content-Type(415) 문제가 아님을 확인.
- 4차: 본문 형태 진단(키 이름·값 타입·등록 값과의 일치 여부만, 값은 미출력)을 추가. `keys=projectId,carrierId,trackingNumber`, 택배사·송장 일치, 400. 원인 확정.
- 5차: 수신기 수정 후 같은 절차로 성공.

관찰한 공급자 동작(더미 송장·콘솔 Trigger 기준이며 보장된 사양은 아니다):

- 등록 직후 자동 초기 알림은 다섯 번 모두 오지 않았다.
- Trigger 후 콜백 도착까지 대체로 약 1분 30초 ~ 2분 30초 걸렸다. 실제 프로세스 검증에서는 등록 후 약 4분 40초 뒤에 도착했다(클릭 시각은 기록하지 않았다).
- 2XX가 아닌 응답에는 약 7분 30초 뒤 재시도가 한 번 관찰됐다.

이 검증이 확인하지 않은 것:

- 실제 배송 중 송장의 상태 변화로 발생하는 콜백과 상태 전환(더미 송장은 `in_transit` 그대로였고 조회 시각만 갱신됐다).
- 구매 승인 → 송장 입력 → 화면 표시까지의 UI 전체 흐름, 배포 환경, 배송 설정 4개(`DELIVERY_ENABLED`, `DELIVERY_TRACKING_ENABLED`, `DELIVERY_WEBHOOK_SECRET`, `DELIVERY_PUBLIC_URL`)의 실제 값. 2026-10-02 기준 루트 `.env`에는 이 4개가 없으며, 실험은 프로세스 환경변수로 임시 값(메모리에서 만든 비밀키, ngrok 주소)을 주입했다.
- 장시간 상시 실행(48시간 등록의 24시간 전 갱신, 프로세스 재시작 후 잠금 회수)과 실제 로그인 사용자의 배송 등록 API 경로.
- `projectId` 값의 의미와 검증 필요 여부. 현재는 읽지 않는다.

### 실제 서버·worker 프로세스 검증 (`apps/api/scripts/check-delivery-server-live.ts`)

위 검증은 스크립트가 모듈을 직접 조립했다. 이 검증은 제품 진입점 `src/serve.ts`와 `src/deliveries/run-worker.ts`를 **별도 프로세스로 실행**한다. 2026-10-01T17:24Z 실행 결과는 `LIVE_SERVER_WORKER_DB_UPDATE_OK`이다.

| 단계 | 결과 |
|---|---|
| 격리 확인 (프로세스 시작 전) | 성공. `shipments`·`shipment_jobs`는 일회용 스키마, `users`는 `public`으로 해석 |
| `serve.ts` 시작, `/api/health` | 성공 (로컬 200, 터널 경유 200) |
| `run-worker.ts` 시작 → 예약 → 외부 등록 | 성공 (`DELIVERY_WORKER_STARTED` 약 3초 뒤 `register` 완료) |
| 등록 직후 보완 조회 → DB 반영 | 성공 (`in_transit`) |
| 콘솔 Trigger → 실제 서버의 웹훅 경로 | 성공 (17:28:58Z `POST` 202, 1102ms). 로그인·Origin 검사 없이 통과 |
| worker 재조회 → DB 반영 | 성공 (17:29:04Z 조회 시각 갱신, `refresh` 완료 2건, 오류 없음) |
| 정리 | 두 프로세스 종료, 등록 만료, 스키마 삭제. 잔존 스키마 0건, `public.shipments`·`public.shipment_jobs` 0건 그대로 |

방법과 주의:

- 두 프로세스는 `DATABASE_URL`만 받으므로 직접(비풀링) 엔드포인트 URL에 `options=-c search_path=<일회용 스키마>,public`을 붙여 격리한다. **Neon은 시작 매개변수 `search_path=`를 무시한다**(실효 값이 기본값 그대로였고, 격리 확인이 이를 잡아 첫 실행을 등록 전에 중단했다). `options=-c` 방식은 적용된다.
- 터널에는 서버 전체를 노출하지 않는다. 스크립트의 중계기(8898 → 서버 8899)가 `GET /api/health`와 `POST /api/delivery-webhooks/*`만 전달하고 나머지는 404로 끝낸다. 중계기가 시각·메서드·경로 종류·응답 코드만 기록한다.
- 자식 프로세스 출력은 고정 상태 문구만 중계하고 그 밖의 출력은 가린다.
- 실행: ngrok을 8898로 띄운 뒤 `npx tsx scripts/check-delivery-server-live.ts <공개 HTTPS 원점>` (`apps/api`에서).

## 구성

| 파일 (`apps/api/src/deliveries/`) | 책임 |
|---|---|
| `webhook.ts` | 배송별 비밀 콜백 URL 생성·검사, 본문 대조, 영속 refresh 작업 저장 |
| `job-repository.ts` | 작업 병합·선점·잠금 회수·재시도·갱신 예약·원자적 결과 반영 |
| `worker.ts` | 작업 종류별 외부 호출, 조회와 저장 단계 연결 |
| `refresh.ts` | 이벤트 시각 비교 및 배송 상태 갱신 규칙 |
| `delivery-tracker.ts` | 인증된 GraphQL 조회·등록, 15초 제한, 민감 오류 제거 |
| `tracking-config.ts` | 명시적 활성화와 필수 설정 검증 |
| `loop.ts` / `run-worker.ts` | 독립 프로세스 반복 실행·종료 처리, `--once` 예약 실행(처리 후 종료) |
| `database.ts` | DB·트랜잭션 공통 타입 |

## 알림 처리와 신뢰 경계

1. `POST /api/delivery-webhooks/:shipmentId/:token`으로 수신한다. 일반 로그인·Origin 검사를 적용하지 않는 외부 전용 경로다.
2. 서버 비밀키로 만든 배송별 토큰을 일정 시간 비교 방식으로 검사한다. 이 토큰은 **URL 접근 권한이지 외부 업체가 보냈다는 서명이 아니다**. 배송 ID·토큰·전체 URL·본문을 로그에 남기지 않는다. 프록시·배포 플랫폼 접근 로그에서도 경로를 가려야 한다.
3. JSON 최대 4KiB. 본문의 `carrierId`, `trackingNumber`가 문자열이고 해당 배송과 일치해야 한다. 실제 공급자는 문서에 없는 `projectId`를 함께 보내므로 그 밖의 필드는 거절하지 않고 무시한다. 상태·주소·수취인 등 어떤 추가 필드도 읽거나 저장하지 않는다. 비활성 배송은 작업 없이 202로 끝낸다.
4. DB 트랜잭션에서 refresh 작업을 저장한 뒤에만 202를 반환한다. 저장 실패는 상세 없는 503으로 외부 재시도를 유도한다. 외부 조회를 HTTP 응답에서 기다리지 않는다.
5. 실행기는 DB에 저장된 택배사·송장번호로 인증 API를 재조회한다. 콜백은 조회 신호일 뿐 상태 변경 근거가 아니다.

배송별 콜백 URL은 재연결·갱신 때도 고정한다. 늦은 등록 요청이 새 URL을 과거 URL로 덮어쓰지 않게 하기 위함이다. 비활성 기간 알림은 무시하고 재연결 후 알림은 현재 상태 재조회에만 사용한다. 비밀키 교체는 API·실행기에 함께 적용하고 활성 배송의 등록을 다시 수행해야 한다.

공식 문서는 큐를 통한 재조회, 빠른 202 응답, 실패 콜백 재시도를 안내하며 기본 콜백을 신뢰하지 말라고 명시한다. HMAC 발신자 인증은 별도 문의 대상이다. [Delivery Tracker 웹훅 문서](https://tracker.delivery/docs/tracking-webhook-api)

## 작업 정책

- 웹 서버와 별도 프로세스다. 한 실행기는 5초 간격으로 한 작업씩 처리하고, 1분 간격으로 갱신 필요 대상을 최대 100개 예약한다. 외부 쿼터·DB 비용을 실제 운영 전에 확인한다.
- 배송 행을 먼저 잠그고, 유효한 실행 작업이 없는 배송만 선점한다. 작업 종류가 달라도 배송당 하나씩 처리한다. DB 트랜잭션 중 외부 API를 호출하지 않는다.
- 잠금은 60초다. 서버 종료 후 만료 작업을 회수하며 `attempts` 증가로 이전 실행 결과를 차단한다. 시도 한도를 다 쓴 만료 작업은 `failed`로 정리한 뒤 같은 선점 호출에서 다음 대상을 이어서 찾는다. 정리만 하고 빈 결과를 돌려주면 예약 실행이 큐가 빈 것으로 보고 끝나기 때문이다. 실제 다중 연결 PostgreSQL 경합은 추가 검증 대상이다.
- 등록·연결 해제 등으로 `tracking_version`이 달라졌으면 옛 결과를 적용하지 않고 현재 추적 의도에 맞는 후속 작업을 예약한다. 마이그레이션 `0007_delivery_tracking_version.sql`이 필요하다.
- 같은 배송·종류의 대기 작업은 하나다. 실행 중 도착한 새 알림은 다음 대기 작업에 보존한다. 콜백 재조회는 최근 조회 시도부터 최소 60초 뒤로 예약한다.
- 외부 실패는 최대 5번 시도한다. 재시도 간격은 1·2·4·8분이다. 기존 배송 상태·마지막 성공 시각을 유지하고 오류 코드와 시도 시각만 기록한다. 외부 오류 원문은 저장하지 않는다.
- 5번 실패한 작업은 `failed`로 보존한다. 등록 실패는 갱신 예약기가 24시간 쉬었다가 새 작업으로 재시도한다. 조회 실패는 새 콜백 또는 다음 등록 갱신 후 조회로 재시작할 수 있다. 이 사이 화면에는 오래된 성공 상태와 실패 표시가 함께 남을 수 있다.
- 등록은 현재부터 48시간 만료로 요청하고 남은 기간이 24시간 이하이면 갱신한다. 성공 직후 보완 조회도 예약한다. 등록만 성공했다고 기존 조회 실패 표시를 지우지 않는다.
- 배송 완료·모든 연결 해제는 갱신을 멈추고 콜백을 무시한다. `unregister` 작업은 로컬 종료 정리이며 **원격 만료 시간을 앞당기는 API를 호출하지 않는다**. 마지막 외부 등록의 TTL 만료까지 최장 약 48시간 등록이 남는다. 지연된 해제가 재등록을 취소하는 경합을 피하려는 선택이다. [공식 TTL 권고](https://tracker.delivery/docs/tracking-webhook-api)
- 과거 이벤트나 같은 이벤트 시각은 배송 상태를 덮어쓰지 않는다. 조회 성공 시각은 갱신할 수 있다. 배송 완료를 요청서 전체 완료나 수량 전체 도착으로 해석하지 않는다.

## 활성화 전 준비

개발용 DB 마이그레이션만 적용했으며 아래 worker 실행·웹훅 활성화는 아직 하지 않았다.

- API와 실행기에 동일한 `DATABASE_URL`, `DELIVERY_ENABLED=true`, `DELIVERY_TRACKING_ENABLED=true`를 설정한다.
- 동일한 `DELIVERY_TRACKER_CLIENT_ID`, `DELIVERY_TRACKER_CLIENT_SECRET`, `DELIVERY_PUBLIC_URL`(공개 HTTPS 원점), `DELIVERY_WEBHOOK_SECRET`(무작위 32바이트 이상 권장)을 주입한다. 별도의 운영 비밀 관리 경로를 사용하고 채팅에 붙이지 않는다.
- API는 기존 런타임 구성을 사용한다. 실행기는 **프로세스 환경변수만** 읽으며 환경 파일을 자동으로 읽지 않는다.
- 대상 DB를 확인하고 미적용 마이그레이션을 먼저 반영한다. API와 worker가 같은 환경·DB·비밀키를 사용하는지 확인한다.
- 상시 실행: `npm run delivery:worker --workspace @vada/api`. SIGINT/SIGTERM 시 새 작업 선점을 멈추고 진행 중 작업을 정리한다. 강제 종료된 작업은 잠금 만료 후 회수한다.
- 무료 Render 웹 서비스 내부 타이머에 의존하지 않는다. 무료 서비스는 15분간 요청이 없으면 정지하고 worker·cron용 무료 인스턴스는 없다. [Render 무료 서비스 제한](https://render.com/docs/free)
- 실행 환경은 **GitHub Actions 예약 실행**으로 정했다(2026-10-02, 초기 개발 단계의 비용 기준). 아래 "예약 실행" 절을 따른다. 아직 켜지 않았다.

## 예약 실행 (GitHub Actions)

상시 프로세스 대신 `.github/workflows/delivery-worker.yml`이 6시간마다 `npm run delivery:worker:once --workspace @vada/api`를 실행한다. `--once`는 갱신 대상을 예약하고 지금 실행 가능한 작업을 비운 뒤 종료한다(작업 200개 또는 4분 상한). DB 등 인프라 오류는 삼키지 않고 실패로 종료해 실행 기록에 드러낸다. 외부 조회·등록 실패는 작업 재시도로 남고 화면에 "최근 확인 실패"로 보이며, 실행 자체는 성공으로 끝난다.

간격이 6시간일 때의 동작:

- 배송 상태 반영은 최대 6시간 늦는다. 등록 시점의 상태는 등록 API가 바로 저장한다. 택배사 추적 등록과 실패 재시도는 다음 실행에서 처리한다.
- 48시간 등록은 만료 24시간 전부터 갱신하므로 그 사이 네 번 실행된다.
- 급하면 Actions 화면의 수동 실행(`workflow_dispatch`)으로 바로 한 번 돌린다.
- 간격은 워크플로 파일의 `cron` 한 줄이며 `main`에 반영돼야 적용된다. 예약 실행은 기본 브랜치의 파일만 돌린다.

실행 시간 한도: `vada-hq`는 GitHub Free 조직이라 비공개 저장소 Actions가 월 2,000분이다. 6시간 간격은 월 120회로, 1회 1~2분이면 120~240분이다(실측 전 추정). 결제 수단이 없으면 한도 소진 시 다음 달까지 실행이 막히고, 있으면 초과분이 과금되므로 예산 한도를 확인한다. [Actions 과금](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [예약 실행 제약](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

켜는 순서(아직 수행하지 않았다. 각 단계는 승인 후 진행):

1. 배포 DB(`m1-preview`)에 마이그레이션 0005~0007 적용.
2. Render 웹 서비스 환경변수: `DELIVERY_ENABLED=true`, `DELIVERY_TRACKING_ENABLED=true`, `DELIVERY_TRACKER_CLIENT_ID`, `DELIVERY_TRACKER_CLIENT_SECRET`, `DELIVERY_PUBLIC_URL`(서비스의 공개 HTTPS 원점), `DELIVERY_WEBHOOK_SECRET`(무작위 32바이트 이상).
3. GitHub 저장소 Secrets: `DELIVERY_DATABASE_URL`(배포 DB), `DELIVERY_TRACKER_CLIENT_ID`, `DELIVERY_TRACKER_CLIENT_SECRET`, `DELIVERY_PUBLIC_URL`, `DELIVERY_WEBHOOK_SECRET`. **공개 주소와 비밀키는 2번과 같은 값**이어야 콜백 URL이 일치한다.
4. 워크플로 파일을 `main`에 반영.
5. 저장소 변수 `DELIVERY_WORKER_ENABLED=true` 설정 후 수동 실행으로 `DELIVERY_WORKER_DRAINED` 출력과 소요 시간을 확인.

끄기: 저장소 변수 `DELIVERY_WORKER_ENABLED`를 지우거나 `false`로 바꾼다. 작업은 건너뛰며 실행 시간을 쓰지 않는다. 이미 등록된 외부 추적은 최장 48시간 뒤 만료된다.

미검증:

- ~~`--once`의 실제 실행~~ → 2026-10-03 확인. `scripts/check-delivery-once-live.ts`(`apps/api`, 인수: 공개 HTTPS 원점)로 일회용 스키마에서 1회차 등록·보완 조회 2건 처리 후 정상 종료(6.8초), 2회차 처리 0건 정상 종료(2.5초), 테스트 등록 만료·스키마 삭제. 콜백을 기다리지 않으므로 터널은 필요 없다.
- GitHub 실행 1회의 실제 소요 시간, 예약 지연 정도.
- Neon 무료 요금제에서 6시간마다 DB를 깨우는 것이 사용량 한도에 미치는 영향.
- 정지 상태의 무료 웹 서비스로 온 첫 콜백이 공급자 재시도로 복구되는지.

## 검증과 남은 확인

자동 검사: 잘못된 토큰·송장 거부, 중복 콜백 병합, 저장 실패 시 503, 실패 상태 보존·백오프·시도 상한, 갱신 예약, 잠금 회수·옛 결과 거부, 연결 변경 경합, 과거 이벤트 무시, 설정 검증, 반복 실행 종료.

실제 연결 검증은 `check-delivery-webhook-live.ts`로 수행했다(위 기록). 더미 송장으로 worker 등록 → 콘솔 테스트 알림 → refresh 작업 → DB 조회 시각 갱신을 확인했다. 기존 수동 등록 API는 ISO 더미 송장을 허용하지 않으므로 검증용 데이터 준비 절차가 먼저 필요하다. 제품 입력 검증을 임의로 완화하지 않는다.

실제 운영 전 추가 확인: 동일 송장에 여러 콜백 URL을 등록할 때 공급자 동작, 다중 PostgreSQL 연결 경합, 장시간 정지 뒤 복구, 콜백 로그 마스킹, 공급자 호출 한도. 이번 테스트로 실제 배송 지연·지원 택배사 범위나 운영 신뢰성을 확정하지 않는다.
