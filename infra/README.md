# infra/

Terraform 코드.

- 리전: **서울(ap-northeast-2)** — CloudFront용 ACM 인증서만 us-east-1
- 상태: S3 백엔드 + `use_lockfile = true` (Terraform 1.11+ 네이티브 잠금, DynamoDB 불필요)
- 비용 가드레일: 콘솔의 zero spend budget (1센트를 넘으면 알림)

## 처음 한 번 — `bootstrap.sh`

Terraform이 스스로 만들 수 없는 것이 둘 있다. 상태를 둘 S3 버킷과, CI가 맡을 역할이다.
그 둘만 `bootstrap.sh`가 만들고 나머지는 전부 Terraform이 만든다.

**AWS CloudShell에서 돌린다.** 콘솔 세션의 자격 증명을 그대로 쓰므로 장기 액세스 키를
만들지 않는다. 액세스 키는 한 번 새면 되돌릴 수 없고, 새지 않았는지 확인할 방법도 없다.

```
bash infra/bootstrap.sh
```

몇 번을 돌려도 같은 상태가 된다. 이미 있는 것은 건드리지 않는다.

## 처음 한 번 — 데이터베이스 주소

**Terraform은 이 값을 읽지 않는다. 자리 이름만 안다.** 읽게 하면 상태 파일에 평문으로
남고, S3 상태를 볼 수 있는 사람이면 다 본다. Lambda 환경변수에 넣어도 마찬가지다 —
함수 설정을 볼 수 있는 사람이면 다 본다. 그래서 자리 이름만 환경변수로 주고
(`VADA_DATABASE_URL_PARAMETER`), 함수가 **실행할 때** SSM에서 직접 읽는다. 읽을 수
있는 권한도 그 자리 하나로 좁혀 놨다(`infra/api.tf`의 `api_secrets`).

배포용과 개발용은 **다른 데이터베이스**다. Neon 브랜치로 가른다.

| 브랜치 | 쓰는 곳 | 주소가 있는 곳 |
| --- | --- | --- |
| `production` (기본) | 배포된 Lambda | SSM `/vada/skeleton/database-url` |
| `development` | 로컬 개발 | 리포 루트 `.env`의 `VADA_DATABASE_URL` |

가르지 않으면 로컬에서 `just seed`를 잘못 돌린 것이 배포된 데이터를 지운다.

값을 넣는 것은 CloudShell에서 한 번이다. 연결 문자열은 SQLAlchemy 방언을 붙여
`postgresql+psycopg://`로 시작해야 하고, **Neon 커넥션 풀러(`-pooler` 호스트)는 쓰지
않는다** — psycopg3이 같은 질의를 반복하면 서버 측 prepared statement로 올리는데,
PgBouncer의 트랜잭션 모드가 그것을 깬다.

```
aws ssm put-parameter --name /vada/skeleton/database-url \
  --type SecureString --overwrite --value '<연결 문자열>'
```

마이그레이션은 아직 사람이 돌린다. 자동화는 걷는 뼈대의 **하지 않은 것** 목록에 있다.

## 이 README가 전에 전제하던 것과 다른 셋

판정과 근거는 이슈 #78에 있다.

**계정을 dev / prod로 나누지 않는다.** 계정 하나로 시작한다. 독립 계정은 나중에
AWS Organizations에 **멤버로 초대해 넣을 수 있다** — 되돌릴 수 있다. 반대로 지금
조직을 만들면 이 계정이 **관리 계정**이 되는데, AWS는 관리 계정에 리소스를 두지 말라고
권장한다. SCP가 관리 계정의 사용자·역할을 제한하지 못하기 때문이다.

**Budgets를 코드에 넣지 않았다.** 부트스트랩 순서상 코드보다 먼저 필요해 콘솔에서
만들었다. Terraform으로 옮길지는 나중에 정한다.

**SES 프로덕션 액세스와 도메인·Route 53 존은 첫 배포에 넣지 않는다.** 걷는 뼈대에서
일부러 뺐다. 기본 주소로 충분하고, 나중에 붙여도 구조가 바뀌지 않는다.
