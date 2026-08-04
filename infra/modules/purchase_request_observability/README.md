# Purchase request observability

구매 요청 API의 구조화 로그 보존, 영속 실패 메트릭·알람과 SNS 이메일 구독을 정의한다. 호출하는 Lambda 리소스는 `lambda_observability` 출력의 환경 변수와 `tracing_mode = "Active"`를 적용하고, 출력에 열거된 최소 X-Ray 쓰기 권한을 실행 역할에 부여해야 한다.

애플리케이션의 Powertools 메트릭과 로그 기반 알람 메트릭은 이름을 분리한다. 같은 영속 실패를 대시보드에서 중복 집계하지 않도록 `PurchaseRequestPersistenceFailureCount`는 진단용, `PurchaseRequestPersistenceFailureAlarmCount`는 알람용으로 사용한다.

이 모듈을 계획·적용하고 SNS 구독을 확인하거나 시험 메시지를 보내는 동작은 별도의 사람 승인이 필요하다. 이 저장소 변경은 AWS 리소스를 만들거나 이메일을 전송하지 않는다.
