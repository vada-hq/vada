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
