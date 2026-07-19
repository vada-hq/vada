# infra/

Terraform 코드 (첫 AWS 배포 시점에 작성).

- 리전: **서울(ap-northeast-2)** — CloudFront용 ACM 인증서만 us-east-1
- 상태: S3 백엔드 + `use_lockfile = true` (Terraform 1.11+ 네이티브 잠금, DynamoDB 불필요)
- 계정: dev / prod 분리 (AWS Organizations)
- 비용 가드레일: AWS Budgets 단계 알람을 코드에 포함
- 첫 배포 전 체크: SES 프로덕션 액세스 신청, 도메인·Route 53 존
