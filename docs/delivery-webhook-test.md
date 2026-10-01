# 배송 웹훅 연결 실험

제품·DB에 연결하지 않는 일회성 실험이다. 실제 배송이 아니라 공식 가상 송장으로 외부 알림 → 인증 API 재조회를 확인한다.

## 실행

1. PowerShell 창 1에서 아래 명령을 실행하고 창을 유지한다. ngrok 계정 인증이 필요하다는 오류가 나면 먼저 중단하고 인증 설정을 확인한다. 토큰은 공유하지 않는다.

```powershell
ngrok http http://127.0.0.1:8898 --inspect=false
```

2. `Forwarding`에 나온 공개 HTTPS 주소를 복사한다. 기존 VADA 서버 포트가 아니라 실험 포트 8898만 공개한다.
3. PowerShell 창 2에서 실행한다.

```powershell
cd C:\Users\82108\vada-m1
powershell -NoProfile -File .\scripts\start-delivery-webhook.ps1
```

4. 공개 HTTPS 주소(경로 없이), Delivery Tracker Client ID, Client Secret을 순서대로 입력한다. 키는 숨김 입력이며 파일에 저장하지 않는다.
5. `INITIAL_LOOKUP_OK`, `REGISTERED`가 나오면 Delivery Tracker 콘솔의 해당 프로젝트 → Webhook에서 출력된 가상 송장을 찾아 `Callback Call Test Trigger`를 누른다. 초기 등록 알림이 먼저 올 수도 있다.
6. 두 창을 유지하며 수 분 기다린다. 창 2의 `CALLBACK_RECEIVED` 다음 `LOOKUP_OK`와 상태·시각이 나오면 연결 성공이다. 이 로그만 공유하고 키와 전체 콜백 URL은 공유하지 않는다.
7. 끝나면 창 2에서 Ctrl+C로 종료하고, 창 1도 Ctrl+C로 터널을 닫는다. 등록 해제를 시도하며 실패하더라도 등록 시점부터 30분 후 만료된다.

## 범위와 한계

- 인터넷 연결이 필요하다. 로컬 테스트 통과가 외부 웹훅 수신 성공을 의미하지 않는다.
- 수신 본문의 상태를 믿지 않고 고정한 가상 송장을 인증 API로 재조회한다. 임의 경로·송장은 거절한다.
- 무작위 콜백 경로는 서명 인증을 대체하지 않는다. 가상 데이터만 사용하며 ngrok에도 요청이 전달된다.
- 202 응답 후 메모리에서 재조회하므로 장애 시 작업 유실이 가능하다. `LOOKUP_FAILED`면 콘솔 테스트 버튼으로 재시도한다. 제품용 영속 큐·자동 재시도는 구현하지 않았다.
- 가상 송장의 완료 시점은 다음 UTC 3시간 경계다. 30분 실험에서 상태 전환까지 일어나지 않을 수 있다. 테스트 버튼은 상태가 그대로여도 알림을 보낸다.
- 이 실험으로 실제 쿠팡 배송의 갱신 지연·전체 지원 범위·송장 수집 편의성을 검증할 수 없다.

## 관련 검사

```powershell
node --test scripts/delivery-webhook.test.mjs
```

공식 근거: [웹훅 등록·수신·테스트](https://tracker.delivery/docs/tracking-webhook-api), [가상 송장](https://tracker.delivery/docs/dummy-tracking-number), [ngrok 명령](https://ngrok.com/docs/gateway/agent/cli).
