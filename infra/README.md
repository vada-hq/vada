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

**어느 브랜치에 붙었는지는 배포가 매번 확인한다.** 기대하는 Neon 브랜치 ID를
`infra/variables.tf`의 `database_branch`에 적어 두고, 배포 후 검사가 실제로 붙은
브랜치와 맞춰 본다. 어긋나면 아무것도 쓰지 않고 실패한다.

이 검사가 없을 때 실제로 이런 일이 있었다. 개발용 `.env`와 배포용 SSM에 같은 연결
문자열이 들어갔는데 배포는 초록불이었다. `{"name":"배포 확인용 계정"}`까지 정확히
기대한 대로 돌아왔다 — 개발용 데이터베이스에 쓰고 그것을 도로 읽었기 때문이다.
사람이 로컬 데이터베이스의 행을 직접 세어 보고서야 드러났다.

브랜치를 바꾸면 `database_branch`도 같이 바꾼다. 안 바꾸면 배포가 멈춘다.

마이그레이션은 아직 사람이 돌린다. 자동화는 걷는 뼈대의 **하지 않은 것** 목록에 있다.

## 화면은 어디서 오는가 — 출처가 하나다

브라우저가 보는 주소는 CloudFront 하나뿐이다. 화면(`/`)도 API(`/api/v1/*`)도
거기서 온다. S3 버킷은 공개하지 않는다 — CloudFront만 읽는다(OAC).

```
브라우저 ──▶ CloudFront ──┬── /*          ──▶ S3 (빌드된 화면)
                          └── /api/v1/*   ──▶ API Gateway ──▶ Lambda
```

**두 출처로 가르지 않은 이유가 둘 있다.** 하나는 CORS다 — 사전 요청·자격 증명·
캐시가 전부 브라우저에서만 드러나고 서버 검사에는 안 걸린다. 다른 하나는 웹이
배포 주소를 몰라도 된다는 것이다. `apiPath()`가 만드는 상대 경로가 로컬에서도
배포에서도 그대로 돈다. 빌드에 주소를 구우면 언젠가 엉뚱한 빌드가 올라간다.

접두사 `/api/v1`은 계약이 아니라 배포 라우팅 사실이라 **소유자가 없다.** 세 곳에
적혀 있다 — `apps/web/src/shared/api/base.ts`, `apps/web/vite.config.ts`,
`infra/cloudfront/api-prefix.js`. 어긋나면 로컬은 멀쩡한 채로 배포된 화면의 모든
요청이 404가 된다. `scripts/check-api-prefix.mjs`가 세 곳을 맞춰 본다.

가장자리에서 도는 조각은 둘 다 `infra/cloudfront/`에 있다. 하나는 접두사를
벗기고, 하나는 파일을 가리키지 않는 주소를 앱에게 넘긴다(새로고침이 깨지지
않게). 배포 전체에 오류 페이지를 바꾸는 방법은 쓰지 않았다 — 그것은 API의
404까지 HTML로 바꾼다.

배포 후 검사가 사람이 여는 주소에 대고 다시 묻는다. 제목이 `VADA`인지, 깊은
주소도 앱에 닿는지, 그리고 `/api/v1/health`가 **본문으로** `{"status":"ok"}`를
주는지. 마지막 것을 상태 코드로 보면 안 된다 — `/api/v1/*` 규칙이 안 걸리면
화면 되돌림이 index.html을 200으로 돌려주고, 그 실패는 초록불로 보인다.

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
