# VADA API

VADA 운영 제품의 FastAPI 모듈형 모놀리스다. 조직·권한·데이터 격리와 트랜잭션 불변식의 서버 정본을 구현한다.

## 개발

리포 루트에서 실행한다.

```bash
just dev-api
just lint-api
just typecheck-api
just test-api
```

구현 전 루트 `AGENTS.md`, `docs/engineering/README.md`, 이 디렉터리의 `AGENTS.md`, 대상 전달 작업의 승인 기준선을 읽는다.

## 운영 데이터베이스 조립

- `VADA_DATABASE_URL`에 psycopg 드라이버를 포함한 SQLAlchemy PostgreSQL URL을 주입하면 앱 팩터리가 사용자·조직 관계와 구매 요청 저장소를 운영 어댑터로 조립한다.
- 인증 정보는 API Gateway JWT authorizer가 검증해 ASGI scope의 `aws.event.requestContext.authorizer.jwt.claims`에 전달한 최소 클레임만 읽는다. 원시 bearer token은 앱에서 다시 해석하지 않는다.
- 앱 기동은 Alembic을 자동 실행하지 않는다. 배포 파이프라인이 별도 단계에서 `alembic upgrade head`를 실행하고 성공한 뒤 애플리케이션을 전환한다.
